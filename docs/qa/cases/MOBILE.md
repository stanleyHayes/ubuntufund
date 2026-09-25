# Mobile platform (iOS & Android) (106 cases)

Install and launch, deep links, permissions, iPad, accessibility, offline/poor network, background/resume, 16 KB Android, store-review flows.

[Back to the QA plan](../README.md)

## MOBILE-001 · P0 · iOS release IPA configuration audit (background modes, purpose strings, privacy manifest, extension)

*Surfaces:* ios  ·  *Type:* compliance

**Before:** Signed EAS build from the final commit using the production profile (UJIMORA_RELEASE=1). Do NOT use a local Xcode build from apps/mobile/ios (it is a stale, gitignored prebuild with extra background modes). macOS with plutil and codesign.

**Steps:**

1. Download the .ipa from EAS/TestFlight and unzip it.
2. Run plutil -p Payload/Ujimora.app/Info.plist and record UIBackgroundModes, NSLocalNetworkUsageDescription, NSBonjourServices, NSLocationWhenInUseUsageDescription, NSLocationAlways*, NSCameraUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription, NSFaceIDUsageDescription, CFBundleURLSchemes, ITSAppUsesNonExemptEncryption, UISupportedInterfaceOrientations and ~ipad, UIRequiresFullScreen, RTCAppGroupIdentifier, RTCScreenSharingExtension.
3. Run codesign -d --entitlements :- Payload/Ujimora.app and the same on Payload/Ujimora.app/PlugIns/UjimoraBroadcast.appex.
4. Open PrivacyInfo.xcprivacy in the bundle; in Xcode Organizer generate the Privacy Report for the archive; run scripts/compliance/inspect-ios-privacy.py if applicable.
5. Compare every string and capability against app.json, APP_REVIEW_NOTES.md and the App Privacy answers.

**Expect:** UIBackgroundModes is exactly [audio]; no NSLocalNetworkUsageDescription and no _expo._tcp Bonjour entry; no NSLocationAlways* keys; location string reads 'Use your location to fill your verification address.'; camera/microphone strings mention live broadcasting; ujimora URL scheme present; ITSAppUsesNonExemptEncryption = false; broadcast extension present with app group group.com.ujimora.app.broadcast on both targets; privacy manifest declares UserDefaults, FileTimestamp, SystemBootTime, DiskSpace and NSPrivacyTracking=false. Any aps-environment entitlement (from expo-notifications) is noted and reflected in review answers.

**Needs:** EAS build service, Apple developer account, TestFlight

**Source:** `apps/mobile/app.json`, `apps/mobile/eas.json`, `apps/mobile/plugins/withReleaseInfoPlist.js`, `apps/mobile/plugins/withBroadcastExtension.js`, `apps/mobile/STORE_SUBMISSION.md`, `scripts/compliance/inspect-ios-privacy.py`

## MOBILE-002 · P0 · Android release AAB/APK merged manifest, backup and native-library audit

*Surfaces:* android  ·  *Type:* compliance

**Before:** Play-signed AAB from EAS production profile (and a universal APK generated with bundletool). Android SDK build-tools (apkanalyzer/aapt2, zipalign), NDK llvm-readelf.

**Steps:**

1. bundletool build-apks --mode=universal on the AAB and extract the APK.
2. apkanalyzer manifest print app.apk; list uses-permission entries, application attributes, services, meta-data and intent filters.
3. Confirm targetSdkVersion, allowBackup, fullBackupContent, dataExtractionRules, and the firebase_messaging_auto_init_enabled, firebase_analytics_collection_enabled and expo.modules.updates.ENABLED meta-data.
4. Confirm expo.modules.location.services.LocationTaskService is absent and the WebRTC mediaProjection service declares foregroundServiceType mediaProjection.
5. Run zipalign -v -c -P 16 4 app.apk, then python scripts/compliance/inspect-android-native.py app.apk --readelf <llvm-readelf>, and record the exit code and the per-library LOAD and RELRO results.

**Expect:** None of these permissions are present: POST_NOTIFICATIONS, READ_MEDIA_IMAGES/VIDEO/AUDIO, READ_EXTERNAL_STORAGE, ACCESS_BACKGROUND_LOCATION, SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE_LOCATION. CAMERA, RECORD_AUDIO, ACCESS_FINE/COARSE_LOCATION, FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PROJECTION are present. Every other transitive permission is listed and reconciled with Play Data safety and NATIVE_PERMISSIONS.md. allowBackup=false with the ujimora backup and extraction rules. Both Firebase auto-init flags are false. expo.modules.updates.ENABLED=false, because app.json sets updates.enabled:false and OTA updates are off. targetSdk is 36 and the ujimora scheme intent filter is present. The ZIP 16 KB alignment check passes. inspect-android-native.py exits 0: all 48 packaged 64-bit libraries pass both the LOAD-alignment check and the RELRO-end check ((VirtAddr+MemSiz) % 0x4000 == 0). This works because plugins/relro16k.gradle, applied by withPrebuiltRelroAlignment.js, aligns prebuilt RELRO ends at build time. Any LOAD or RELRO failure, or an artifact built without the relro16k step, blocks the release.

**Needs:** EAS build, Google Play Console internal track

**Source:** `apps/mobile/app.json`, `apps/mobile/plugins/withPrivateBackupRules.js`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `apps/mobile/plugins/withForegroundLocationOnly.js`, `apps/mobile/plugins/withAndroidPageAlignment.js`, `apps/mobile/plugins/withPrebuiltRelroAlignment.js`, `apps/mobile/plugins/relro16k.gradle`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/NATIVE_PERMISSIONS.md`, `scripts/compliance/inspect-android-native.py`

## MOBILE-003 · P0 · Fresh install and cold start signed out: browse without any permission prompt

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Release build installed fresh on: iPhone (Face ID, latest iOS), small iPhone (SE), iPad, Android 16 Pixel, a mid/low-end Android 12-13 device. Staging API with at least 5 active campaigns, 1 organization, 1 creator page.

**Steps:**

1. Install and launch the app with network on; time from tap to Home content.
2. Observe native green splash then the animated Ujimora splash, then Home tab.
3. Scroll Home (Featured Campaigns, Urgent, Recently Added, Browse Categories); tap a category chip.
4. Open Explore, type in 'Search campaigns...', open a campaign, go back.
5. Open Profile tab while signed out and tap 'Legal & trust · All policies'.
6. Force-quit and relaunch 3 times; also relaunch after 10 minutes in background.

**Expect:** App launches without crash in under ~5 s on mid-range hardware (record times); no system prompts (notifications, tracking, location, camera, photos, local network) appear. Home and Explore load public campaigns; category filter navigates to Explore; campaign detail shows Donate Now/Share. Profile shows the Sign In gate plus the legal link. Relaunches are stable; fonts render (Outfit), no flash of unstyled text or white screen.

**Needs:** Staging API reachable over HTTPS

**Source:** `apps/mobile/app/_layout.tsx`, `apps/mobile/src/components/SplashScreen.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/explore.tsx`, `apps/mobile/app/(tabs)/profile.tsx`

## MOBILE-004 · P0 · Release build talks only to the configured HTTPS API and exposes no developer tooling

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Release build; Proxyman/Charles with SSL proxying on a test device; EXPO_PUBLIC_API_URL and EXPO_PUBLIC_WEB_URL set to staging/production HTTPS origins.

**Steps:**

1. Route the device through the proxy and use Home, a campaign, login and Settings.
2. Inspect every request host and scheme.
3. Shake the device / press Cmd-D equivalent / try the ujimora://expo-development-client link.
4. Inspect Share output from a campaign for the web origin.

**Expect:** All API calls go to https://<api-host>/api/v1/*; no http://, localhost, 10.0.2.2 or LAN IPs. No Expo dev menu, dev launcher or red-box. The dev-client link routes to Home. Shared links use the configured web origin (app.ujimora.com in production).

**Needs:** Proxy tool

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/navigation/resolvePath.ts`

## MOBILE-009 · P0 · Shared donate link with preset amount on iOS vs Android

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** Active campaign with slug that accepts donations; closed campaign with slug.

**Steps:**

1. Open ujimora://c/<slug>/donate?amount=50 on iOS.
2. On the 'Support this campaign' screen tap 'Continue in browser'; inspect the Safari URL.
3. Open the same link on Android and inspect the Donate form.
4. Repeat with amount=abc, amount=-5, amount=10.555 and with the closed campaign's slug.
5. Open ujimora://c/does-not-exist/donate.

**Expect:** iOS: external screen (no amount/payment inputs in-app); Safari opens https://app.ujimora.com/c/<slug>/donate?amount=50 (invalid amounts omitted). Android: in-app form with Amount prefilled 50. Closed campaign shows 'not accepting donations' and no pay button. Unknown slug shows an error with 'Try again', no crash.

**Needs:** Web app deployed at EXPO_PUBLIC_WEB_URL

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/campaign/shared.tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/donate/[id].tsx`

## MOBILE-012 · P0 · Deep links cannot bypass authorization (other users' studio, management, refunds, private docs)

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** User A (member, KYC approved) signed in. User B owns campaign X with an active status; User B has donation D. Staff access to API logs.

**Steps:**

1. As A open ujimora://campaigns/<X>/live; tap 'Create live session'.
2. As A open ujimora://campaign/manage?id=<X>.
3. As A open ujimora://donations/refund/<D>.
4. As A open ujimora://campaigns/<B-draft-or-pending-campaign-id>.
5. Signed out, open ujimora://settings, ujimora://wallet, ujimora://my-donations.

**Expect:** Studio creation is rejected by the API with a readable error (no session created). Manage shows 'Only the campaign owner can manage these settings.' and no payout form. Refund request for another user's donation fails to load (403/404 message) and cannot be submitted. Non-public campaigns do not render details. Signed-out protected screens show 'Sign in to continue'.

**Needs:** Staging API

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/mobile/app/campaign/manage.tsx`, `apps/mobile/app/refund-request.tsx`, `apps/mobile/src/components/SignInRequired.tsx`

## MOBILE-016 · P0 · Camera permission: grant, deny, and permanently denied paths in all upload fields

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Signed-in account on a fresh install (permissions never asked). Screens: KYC ('Front of your ID', Selfie), Start a campaign step 2 'Campaign cover', and the Edit profile 'Cover image' / 'Profile photo' camera icons.

**Steps:**

1. On KYC 'Front of your ID', tap Camera and read the system prompt. Allow, take a photo and confirm 'Uploaded'.
2. Reset permissions (iOS: Settings > Ujimora > Camera off; Android: App info > Permissions > Camera > Deny). Tap Camera again.
3. Android: deny twice to reach 'Don't ask again', then tap Camera again.
4. Tap the 'Open Settings' button that appears, turn Camera on, return to the app and tap Camera again.
5. After a denial, tap 'Choose file'.
6. Repeat camera capture on the campaign cover and the profile photo (crop UI on both).

**Expect:** The prompt shows the app.json camera purpose string. Granted: the photo uploads (under 4 MB) and shows Uploaded or a preview. Android denial while the OS can still ask: 'Camera permission is needed to take a photo. You can choose a file instead.' with no Open Settings button. Permanently denied (iOS after any denial; Android after 'Don't ask again' or a second denial): 'Camera access is off for Ujimora. Open Settings to allow it, or choose a file instead.' plus an 'Open Settings' button that opens Ujimora's page in the system Settings app. After allowing the camera there, the next tap works and the message and button clear. The file and library path still works after a denial, with no crash. Cover crops at 16:9 and the profile photo at 1:1. With biometric unlock on, a camera or picker hand-off of up to 10 minutes does not lock the app.

**Needs:** Cloudinary / private KYC storage for uploads

**Source:** `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app.json`

## MOBILE-020 · P0 · App never requests notification permission; push not advertised

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Fresh install on iOS and Android 13+.

**Steps:**

1. Walk through: launch, register, sign in, enable biometrics, KYC, create campaign, donate (Android), subscribe (sandbox), go live, open Settings > Notifications.
2. Check iOS Settings > Notifications list and Android App info > Notifications.
3. Toggle activity alerts/emails in Settings.

**Expect:** No notification permission dialog at any point. Ujimora is absent from iOS notification settings (or shows not requested); Android shows no runtime notification permission requested. Settings shows 'SMS and device push notifications are not available yet.' with only inbox/email options.

**Needs:** None

**Source:** `apps/mobile/src/services/notifications.ts`, `apps/mobile/app/settings.tsx`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `docs/compliance/PUSH_NOTIFICATIONS.md`

## MOBILE-022 · P0 · Individual registration on device with legal acceptance and password rules

*Surfaces:* android, api, email, ios  ·  *Type:* functional

**Before:** New email address; release build.

**Steps:**

1. Profile > Sign In > 'Create one'.
2. Fill Full name, Email, Password 'short'; observe hint; set a strong password; mismatched Confirm password.
3. Try to submit without ticking terms and 18+ confirmation.
4. Tap Terms of Service, Privacy Policy and 'Read Acceptable Use Policy' links and return.
5. Tick both, submit; double-tap the submit button.
6. Register again with the same email.

**Expect:** Submit disabled until name, email, 8+ char password, matching confirmation and both checkboxes are set. Legal links open in-app pages and return with form data intact. One account created (double tap does not create two); user lands on Home signed in with the bell strip visible. Duplicate email shows a readable error. Password-manager autofill offers to save the new password.

**Needs:** Email provider (welcome/verification)

**Source:** `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/context/AuthContext.tsx`

## MOBILE-024 · P0 · Sign in: wrong password, MFA authenticator code and recovery code

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Account without MFA; account with MFA enabled and unused recovery codes; authenticator app.

**Steps:**

1. Sign in with a wrong password; then correct password.
2. MFA account: enter email/password, tap Sign In; enter a wrong 6-digit code; then a valid code (test paste from authenticator and SMS-style autofill into the OTP boxes).
3. Sign out; sign in using 'Use a recovery code' with a valid code; reuse the same recovery code on a second sign-in.
4. Make 11+ rapid wrong factor attempts.

**Expect:** Wrong password shows an error without clearing email. MFA account reveals the OTP input after the first attempt; no session is issued until the factor succeeds. Valid code signs in and routes to Home. Recovery code works once; reuse is rejected. Rate limit returns a readable error. Password field is secure with show/hide toggle.

**Needs:** MFA_ENCRYPTION_KEY configured on API

**Source:** `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/src/components/OtpInput.tsx`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## MOBILE-026 · P0 · Enable biometric unlock and its denial/unavailable paths

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** iPhone with Face ID, iPhone with Touch ID, Android with fingerprint (strong class) and one Android with only face unlock (weak) or no biometrics enrolled.

**Steps:**

1. Settings > biometric section (label 'Face ID' / 'Fingerprint unlock'); switch 'Biometric unlock' on; approve the OS prompt.
2. Cancel the prompt on a second attempt.
3. iOS: Settings > Face ID & Passcode > Other Apps > Ujimora off, then try enabling.
4. Device with no enrolled biometrics / only weak face unlock: open the section.
5. Tap 'Lock now'; then disable the switch (requires biometric read).

**Expect:** Prompt shows the Face ID purpose string; success message 'Biometric unlock enabled on this device.' Cancel shows 'Biometric confirmation was cancelled or unsuccessful.' and switch stays off. Denied Face ID or unavailable hardware shows 'Supported enrolled biometrics are unavailable...' or an error, never enabling. Lock now shows 'Ujimora is locked'. Disabling requires authentication and shows 'Biometric unlock disabled on this device.'

**Needs:** Physical devices (simulators cannot prove keychain access control)

**Source:** `apps/mobile/src/components/BiometricSettings.tsx`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/session.ts`

## MOBILE-027 · P0 · Background, app-switcher privacy cover, unlock and password fallback

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Biometric unlock enabled, with a wallet balance and a KYC status visible. A second run with biometric unlock disabled.

**Steps:**

1. Open Wallet. Swipe up to the app switcher (iOS) or open Recents (Android), inspect the snapshot, then return without leaving the app.
2. Press Home, wait about 10 s and return.
3. Press Home, wait more than 60 s and return. Tap 'Unlock with biometrics', fail twice, then succeed.
4. Tap Settings > 'Lock now', then 'Sign in with password instead'.
5. With VoiceOver/TalkBack on, check that nothing behind the lock or cover can be focused.
6. Biometric unlock off: repeat the app-switcher/Recents check and the 10-second background.

**Expect:** Biometrics on: the switcher/Recents snapshot shows the 'Ujimora is locked' cover (buttons disabled while the app is inactive), not balances. Returning within 60 s shows the same screen with no unlock. After more than 60 s in the background, 'Ujimora is locked' requires unlock. Unlock restores the session through a server refresh, and failed attempts show a friendly error. The password fallback ends the session and clears the biometric vault. Screen readers cannot reach hidden content. Biometrics off: the iOS app-switcher snapshot shows a plain branded cover (Ujimora logo only), and content comes back on return with no unlock. Known open issue I106: Android Recents thumbnails and screenshots can still show content for users without biometric lock. FLAG_SECURE / Recents blocking is not implemented and is an owner decision; record what Android shows.

**Needs:** Physical devices

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/components/PrivacyCover.tsx`, `apps/mobile/src/lib/session.ts`

## MOBILE-035 · P0 · Sign out and account switching do not leak data on a shared device

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** User A with biometrics enabled, a pending Android donation, notifications and blocked users; User B separate account.

**Steps:**

1. As A: Profile > Sign out.
2. Press back / swipe back after sign-out.
3. Sign in as B; open the same campaign's Donate screen, Wallet, Settings (biometric switch, blocked users), bell notifications, Creator page, Subscription.
4. Sign back in as A.

**Expect:** Sign out routes to login; back navigation does not reveal A's data. B sees none of A's pending payment, wallet, notifications, blocked users, biometric setting (switch off), subscription or creator data. A's biometric vault was cleared on sign-out (must re-enable). Payment scopes are per user id.

**Needs:** Paystack test keys (for pending payment)

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/context/NotificationContext.tsx`, `apps/mobile/app/(tabs)/profile.tsx`

## MOBILE-037 · P0 · App Review demo account walkthrough on the exact submission build (iPhone + iPad + Android)

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Demo account from APP_REVIEW_NOTES on the production API: ordinary member, KYC approved, MFA and biometrics off, and no wallet, campaign, tip or affiliate balance or payout in progress (otherwise deletion is refused). At least one active campaign with donations, comments, updates, a creator page and an organization. Subscription products live in sandbox. MIN_APP_VERSION_IOS/ANDROID unset.

**Steps:**

1. Sign in with the demo credentials on a clean install.
2. Follow the reviewer notes literally: browse campaigns, organizations, creators and live sessions, and legal pages signed out and in. Donate on iOS (Safari handoff) and Android (Paystack). Open Profile > Subscription ('Your subscription') > Restore purchases. Use Report on each UGC surface, including 'Report Campaign' at the bottom of a campaign, and Block. Open Settings > Delete Account: enter the password, then tap Cancel. Start a campaign as a verified user.
3. Go live, leave the app for 10 s, return.
4. Confirm each path the notes describe exists at the described location.
5. Check that no placeholder text '<...>' remains in the store notes.

**Expect:** Every claim in the corrected APP_REVIEW_NOTES.md can be reproduced on the submission build:
- Restore purchases is under Profile → Subscription. 'Manage App Store/Google Play subscription' appears only after the account has a store subscription.
- Report Campaign asks for a reason. Signed-out users are asked to sign in first, and creators do not see it on their own campaign.
- Comment authors link to their profile.
- Delete account asks for the current password (plus an authenticator code with MFA) and explains blocked closures.
- When the host leaves the app, the live camera and microphone turn off and must be turned back on. The iOS audio background mode only covers ReplayKit screen sharing.
- No 'Update required' screen appears.
The demo account is not staff and never hits an MFA or biometric gate.

**Needs:** Production/staging API, App Store Connect + Play Console review accounts

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/components/LiveVideo.tsx`

## MOBILE-038 · P0 · iOS donation handoff: no in-app payment anywhere

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iPhone and iPad release builds. An active campaign with a slug, a legacy active campaign without a slug, a closed or funded campaign, and an active live session. Test signed in and signed out.

**Steps:**

1. Campaign detail > 'Donate Now'.
2. Check that the 'Support this campaign' screen has only text and 'Continue in browser': no amount, email, wallet, crypto, tip or coupon fields.
3. Tap 'Continue in browser' and confirm Safari (not an in-app browser) opens /c/<slug>/donate.
4. Complete a Paystack test payment in Safari, then switch back to the app.
5. From a live viewer page, tap 'Support this campaign' and check the Safari URL for liveSessionId.
6. Repeat from campaign detail, a live session and a shared ujimora://c/<id>/donate link for the legacy campaign without a slug, then for the closed campaign.
7. Double-tap 'Continue in browser'.

**Expect:** No payment UI is rendered inside the iOS app (App Review 3.2.1(vi)/3.2.2). The copy reads 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' It makes no claims about fee review or wallet use. Safari opens the correct campaign, with liveSessionId while the session is active. The legacy campaign without a slug opens /c/<24-hex campaign id>/donate and the website loads it. Returning to the app shows 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.', and campaign totals update after the webhook when the screen is refocused. The closed campaign shows 'This campaign is not accepting donations right now.' with no button. A double tap opens Safari once, or twice without an app error.

**Needs:** Web app, Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/campaign/shared.tsx`

## MOBILE-039 · P0 · iOS wallet top-up handoff and balance refresh after return

*Surfaces:* api, ios, web  ·  *Type:* compliance

**Before:** iOS signed-in account with a GHS wallet, the same credentials on the web, and Paystack test keys.

**Steps:**

1. Profile > Wallet. Confirm the 'Fund your wallet' card has only 'Continue in browser'.
2. Tap it. Safari opens https://app.ujimora.com/wallet; sign in on the web and top up GHS 50 with a test card.
3. Return to the app's Wallet tab without killing it. Wait for the webhook and observe, without navigating.
4. Switch to another tab and back. Pull down on the Wallet screen.
5. Kill and relaunch, then open Wallet.

**Expect:** iOS has no in-app top-up inputs. The web top-up credits GHS 50 exactly once. When the app comes back to the foreground on the Wallet tab, balance and Recent Activity reload automatically with no relaunch. They also reload on tab refocus and pull-to-refresh. The top-up appears once as a DEPOSIT '+GH₵50.00'. The balance card is labelled 'Balance' and shows the wallet's currency with two decimals (e.g. 'GH₵150.00'). If the webhook lands after the return, the next focus, foreground or pull shows it.

**Needs:** Web app, Paystack test keys

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/hooks/useWallet.ts`, `apps/mobile/src/lib/money.ts`, `apps/mobile/src/lib/fundraising.ts`

## MOBILE-040 · P0 · Creator tips are unavailable in both native apps

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** Creator with tips enabled and recent tips with messages.

**Steps:**

1. Open ujimora://creators/<handle> signed out and signed in.
2. Look for amount presets, Custom amount, email field or a Support button.
3. Open the same page on web.
4. As the creator, open Profile > Creator page; toggle 'Accept tips'; tap 'View plans' under 'Unlock creator donations'.

**Expect:** Native shows 'Creator tips are not available in this app yet.' with no checkout controls on iOS and Android; recent supporters list and Report (signed-in) still appear. Web shows the tip form. Creator studio 'View plans' goes to the native store subscription screen (no web checkout link).

**Needs:** None

**Source:** `apps/mobile/app/creators/[handle].tsx`, `apps/mobile/app/creator.tsx`, `apps/mobile/src/lib/creators.ts`

## MOBILE-041 · P0 · Native subscription screen shows store-only purchasing and required disclosures

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** STORE_BILLING_ENABLED=true with STORE_BILLING_PRODUCTS; products approved/ready in App Store Connect sandbox and Play license testing.

**Steps:**

1. Profile > Subscription.
2. Toggle Monthly/Yearly; read each plan card.
3. Tap 'Subscription terms', 'Terms of Use', 'Privacy Policy'.
4. Search the screen for any web price, Paystack, coupon field, 'cheaper on web' text or external link.
5. Check the 'Manage App Store subscription' / 'Manage Google Play subscription' button visibility for a store-subscribed account.

**Expect:** Prices come from the store (localized displayPrice) with '/ month' or '/ year'; auto-renewal terms specific to the store; 'Deleting your Ujimora account does not cancel a store subscription.' present; links open the in-app policy pages. No Paystack/web checkout, coupon or external purchase link (web SubscriptionScreen.tsx must not load on native). Store-price-unavailable plans show 'Store price unavailable' with disabled Subscribe.

**Needs:** App Store Connect sandbox, Google Play license testers

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/lib/subscriptions.ts`, `docs/compliance/STORE_BILLING.md`

## MOBILE-042 · P0 · IAP subscribe happy path with server verification and feature unlock

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Sandbox tester (Apple) / license tester (Google) signed in on device; Ujimora account on Community plan whose campaign limit is full; API with Apple/Google IAP credentials and webhooks configured.

**Steps:**

1. Profile > Subscription > Monthly > Subscribe on a paid plan; double-tap Subscribe quickly.
2. Confirm in the store sheet.
3. Observe messages; tap Refresh.
4. Open Start (create campaign) and Go live to confirm new limits/features.
5. In admin, find the subscription and store purchase record.

**Expect:** One store sheet only. After confirmation: 'Your subscription is active.'; CURRENT PLAN shows the plan with 'Access through <date>'; Subscribe button shows 'Current plan'. Plan features unlock (campaign allowance, live streaming). Server record has billingProvider apple/google, correct tier/cycle and expiry; Apple transaction finished after verification; Google acknowledged server-side exactly once.

**Needs:** App Store sandbox, Google Play Billing test, API store webhooks

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`

## MOBILE-043 · P0 · Restore purchases on reinstall/second device and cross-account protection

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** Ujimora account A with an active sandbox subscription bought on device 1; Ujimora account B; device 2 using the same store account.

**Steps:**

1. Device 1: delete and reinstall; sign in as A; Profile > Subscription > 'Restore purchases'.
2. Device 2 (same store account): sign in as A; Restore purchases.
3. Device 2: sign out; sign in as B; Restore purchases; try to Subscribe to the same product.
4. Sign out mid-restore (tap Restore then immediately sign out).

**Expect:** A: 'Your purchases have been restored.' and plan active on both devices. B: 'No active subscription was restored for this account.' and/or an error asking to sign in to the purchasing account; B never inherits A's subscription (appAccountToken/obfuscatedAccountId binding). Signing out mid-restore does not attach the purchase to the wrong user.

**Needs:** App Store sandbox, Google Play Billing test

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`

## MOBILE-044 · P0 · IAP interrupted, pending and offline purchases recover exactly once

*Surfaces:* android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Sandbox testers; Google 'slow test card' / Apple Ask to Buy or interrupted purchase sandbox option.

**Steps:**

1. Start Subscribe; after confirming in the store sheet, force-kill the app before the success message.
2. Relaunch and open Profile > Subscription (do not tap anything).
3. Android: buy with the slow/pending test card; observe message; wait for approval; resume the app.
4. Enable airplane mode right after store confirmation; then re-enable and resume.
5. Cancel the store sheet.

**Expect:** Relaunch silently restores/verifies the purchase and the plan becomes active once (no duplicate charge or second record). Pending shows 'Your purchase is pending approval or payment...' and access arrives after approval on resume. Offline shows a store/connection error; on reconnect the purchase is verified. Cancel shows 'Purchase cancelled.'

**Needs:** App Store sandbox, Google Play Billing test

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`

## MOBILE-047 · P0 · In-app account deletion from Settings

*Surfaces:* android, api, email, ios  ·  *Type:* compliance

**Before:** A disposable account with a donation history, biometric unlock enabled and optionally a sandbox subscription, holding no wallet, campaign, tip or affiliate balance and no payout in progress. A second disposable account with MFA enabled.

**Steps:**

1. Profile > Settings > Danger Zone > 'Delete Account'. Read the inline section.
2. Tap 'Cancel' and confirm nothing changed.
3. Tap 'Delete Account' again, enter a wrong password, tap 'Delete my account' and confirm 'Delete' at the alert.
4. Turn on airplane mode, enter the correct password and repeat.
5. Back online, enter the correct password, tap 'Delete my account', then double-tap 'Delete' at 'Delete your account?'.
6. Try to sign in again with the same credentials and try biometric unlock.
7. MFA account: open the section, check the code field, and delete using a recovery code.
8. Check admin/closure records.

**Expect:** The section explains immediate closure, retained financial and safety records, and that App Store / Google Play subscriptions are not cancelled. It shows 'Checking your balances and campaigns…' while loading, then a 'Current password' field, plus 'Authenticator or recovery code' for MFA accounts. 'Delete my account' stays disabled until a password is entered (and a code of at least 6 characters for MFA). Confirming opens the alert 'Delete your account?' / 'This cannot be undone.'. A wrong password shows the API error inline and the user stays signed in. Offline shows 'Could not reach Ujimora. Check your connection and try again.' Success sends one DELETE, signs out to Login, and clears tokens and the biometric vault. Signing in with the deleted account fails. The server marks the account closed and queues PII erasure. Donations stay for integrity. Open campaigns end: active/funded become expired, pending review becomes draft.

**Needs:** API data-rights/closure jobs

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/lib/accountClosure.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `docs/compliance/DATA_RIGHTS.md`

## MOBILE-048 · P0 · Legal and delete-account pages are public, offline-readable and actionable

*Surfaces:* android, email, ios, web  ·  *Type:* compliance

**Before:** Signed-out app; airplane mode for part of the test; device with and without a mail app.

**Steps:**

1. Signed out: Profile > 'Legal & trust · All policies'; open each policy and 'On this page' anchors.
2. Open ujimora://delete-account; tap 'Request account and data deletion by email' and 'Open account settings on the website'.
3. Enable airplane mode and reopen several policies.
4. Remove the Mail app (iOS) and tap the email action.
5. Verify https://app.ujimora.com/delete-account and ujimora.com/privacy in a browser.

**Expect:** All policies open signed out and offline with effective dates. Email action pre-fills the deletion request; without a mail app an alert explains to contact legal@ujimora.com. Website action opens the browser. Public URLs used in store listings resolve over HTTPS.

**Needs:** Web/marketing deployments

**Source:** `apps/mobile/src/components/LegalScreen.tsx`, `apps/mobile/app/delete-account.tsx`, `packages/types/src/legal.ts`

## MOBILE-049 · P0 · Report is available on every user-generated content surface (signed in)

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Signed-in user A; content by user B: campaign comment, campaign update, donation with message, creator page with tip message, member profile, organization profile, active live session; AI writing preview.

**Steps:**

1. For each surface tap 'Report': comment (choose 'This comment' vs 'This user'), update, donor message on campaign detail, tip message on creator page, profile/organization/live (via UserSafetyControls), AI preview on Start a campaign.
2. Try 'Send report' with under 10 characters.
3. Submit valid reports; double-tap Send report.
4. Check the admin moderation queue.

**Expect:** Report dialog 'Report a safety concern' with reasons and description; Send disabled under 10 characters; success shows 'Report received for moderation review.' Each report lands in the staff queue with the correct target type/id (comment, campaign_update, donation_message, tip_message, user, live, ai_output); double-tap creates one report. Reporter identity not shown to reported user. A user does not see Report on their own comment/update.

**Needs:** Admin moderation queue, OpenAI (AI preview)

**Source:** `apps/mobile/src/components/ReportContent.tsx`, `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/src/components/CampaignUpdatesList.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/app/creators/[handle].tsx`, `apps/mobile/src/components/UserSafetyControls.tsx`, `apps/mobile/src/components/AiWritingAssistant.tsx`

## MOBILE-050 · P0 · Block user and manage blocked users

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Users A and B; B has comments on a campaign, a creator page, a profile and a live session.

**Steps:**

1. As A block B from B's profile ('Block user'), from a comment, from the creator page, and from the live viewer page.
2. Revisit the campaign comments, B's profile, organization and creator page.
3. Settings > Blocked users: 'Unblock <B>'.
4. Try blocking yourself (own profile).

**Expect:** After blocking: profile shows 'User blocked.' with link to Settings; creator/organization pages show blocked state; live page shows 'User blocked. Manage blocked users in Settings.'; B's comments hidden for A (and A's for B). Blocked users list shows B; Unblock restores visibility. Block controls are not shown on your own profile. Blocking does not file a report.

**Needs:** None

**Source:** `apps/mobile/src/components/UserSafetyControls.tsx`, `apps/mobile/src/components/BlockedUsers.tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/src/components/CampaignComments.tsx`

## MOBILE-054 · P0 · Android donation via Paystack hosted checkout: money accuracy end to end

*Surfaces:* admin, android, api, email  ·  *Type:* functional

**Before:** Android release build pointed at staging with Paystack TEST keys and webhook delivery. An active GHS campaign. A signed-in donor with a verified email. Admin access.

**Steps:**

1. Campaign detail > Donate Now. Enter Amount 100.50, keep the email, Name and Message, tick the 18+ content terms, set Tip 5, and choose method 'Card or mobile money · secure checkout'.
2. Check the terms line above the button and open its links. Check the button reads 'Donate 105.50 GHS' and tap it.
3. Pay in the browser tab with a Paystack test card. Close the tab after the web callback page.
4. Watch PaymentStatus until 'Thank you for your support', then tap 'Refresh content review'.
5. Check the campaign's raised amount and donor count, My Donations, Dashboard, the receipt email and the admin ledger.
6. Repeat with a mobile-money test number.

**Expect:** The Paystack checkout amount is 105.50 GHS. Next to the pay button: 'Donations are made under our Terms of Use, Contributor Terms and Privacy Notice. You must be 18 or older to donate.' with working in-app links. After the webhook: status SUCCEEDED and the celebration shows (reduced motion respected). The campaign's raised amount grows by the donation per fee policy, not by the tip. The tip is recorded separately and fees match the plan rate. My Donations shows 'GH₵100.50' with status 'Completed'. One receipt email. The ledger balances with no duplicate entries. The message appears publicly only after content review. Known open issue I086: the donation terms line is informational only; no guest consent is recorded or enforced.

**Needs:** Paystack test keys + webhook, email provider

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/lib/money.ts`

## MOBILE-055 · P0 · Android donation input validation, rounding, coupons and wallet method

*Surfaces:* android, api  ·  *Type:* negative/edge

**Before:** Android signed-in donor with a GHS 20 wallet balance. A valid fee-waiver coupon, an expired one and an over-used one. A guest session.

**Steps:**

1. Try these amounts and watch the button state and label: empty, 0, -1, 0.001, 10.555, 10.5, '100,50', '1,000', '1,000.50', pasted '1e3', 99999999.
2. Tip values: '-5' (pasted), 0.005, 2.50, '2,50'.
3. Signed in: enter a valid coupon and read 'Applied — X GHS more reaches this campaign.', then invalid and expired codes.
4. Signed out: confirm there is no coupon field and no wallet method.
5. Choose 'Ujimora wallet · existing balance' with amount 50 (more than the balance), then 10.
6. With the card method, leave the email empty, then enter an invalid one.

**Expect:** The button is disabled, labelled 'Donate 0 GHS', for empty, zero, negative and more-than-2-decimal amounts, and for invalid tips. 10.5 gives 'Donate 10.50 GHS'. A single decimal comma is accepted: '100,50' is 100.50 and '2,50' is a 2.50 tip. Grouped or ambiguous input ('1,000', '1,000.50') and '1e3' are rejected, never silently turned into 1000. The API also refuses more than 2 decimals (multipleOf 0.01). The coupon preview matches the server fee calculation, and invalid coupons disable Donate with the reason. Guests see neither coupon nor wallet. Over-balance wallet donations return a clear insufficient-funds error with no debit. 10 succeeds and the wallet drops by exactly 10 (plus the tip if any). The card method needs a valid email.

**Needs:** Coupons configured, Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/moneyInput.ts`, `apps/mobile/src/lib/coupons.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/donationIntentRoutes.ts`

## MOBILE-056 · P0 · Android donation idempotency: double tap, network drop, kill and resume

*Surfaces:* admin, android, api  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys. A proxy that can drop the response of POST /donation-intents. Admin view of intents.

**Steps:**

1. Double-tap the Donate button rapidly.
2. Drop the response of POST /donation-intents (the request still reaches the server), then tap Donate again with identical inputs and note the Paystack reference in the opened checkout.
3. Drop the response again, change the amount and tap Donate.
4. After checkout opens, kill the app. Relaunch and reopen the same campaign's Donate screen.
5. Pay in the browser and return. Tap 'Check status' repeatedly and replay the Paystack webhook from the dashboard.

**Expect:** Identical input creates only one intent. After a lost response, the retry reuses the same Idempotency-Key and the API replays the same intent with its open Paystack checkout, so the browser opens the original checkout (same reference), not a new one. Changed input is a separate attempt with a new key; the unpaid earlier attempt is expired by the server sweep after 24 h. After relaunch, the screen shows the pending PaymentStatus with 'Open secure checkout' instead of a new form. Repeated status checks and the webhook replay produce exactly one donation, one ledger credit and one receipt.

**Needs:** Paystack test keys + webhook replay, proxy tool

**Source:** `apps/mobile/src/lib/payments.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/components/PaymentStatus.tsx`

## MOBILE-059 · P0 · Android wallet top-up amount limits, test-mode banner and single credit

*Surfaces:* admin, android, api  ·  *Type:* functional

**Before:** Android signed-in account with a GHS wallet. Paystack test keys (test mode).

**Steps:**

1. Profile > Wallet. Confirm 'Test mode: this checkout does not collect live money.'
2. Enter 0, 0.99, 10000.01, 12.345 and '1,000'. Then enter '150,50', and then 150. Tap 'Fund wallet' twice quickly.
3. Pay in the browser tab and return. Wait for 'Wallet funded'.
4. Kill the app while the top-up is pending, then relaunch Wallet.
5. Start another top-up and pay with a card the provider declines. Return to the app several times over the next 30 minutes after completing payment in the same checkout.
6. Replay the webhook, then check the balance and the ledger.

**Expect:** The hint 'GHS 1–10,000, at most two decimals.' appears under the field. 'Fund wallet' is disabled for 0, 0.99, 10000.01, 12.345 and '1,000', and enabled for 150 and '150,50' (read as 150.50). Only one top-up is created. After verification the balance rises by exactly 150.00, and Recent Activity shows one DEPOSIT '+GH₵150.00'. The pending state recovers after relaunch. After 15 minutes unconfirmed, the card offers 'Start a new payment' with the don't-pay-twice warning. A top-up the provider reported failed is re-checked each time the app returns to the foreground for 30 minutes, and is credited once if it later succeeds. The webhook replay does not credit twice. The production build must NOT show the test-mode banner.

**Needs:** Paystack test keys + webhook

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/lib/moneyInput.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/lib/payments.ts`

## MOBILE-063 · P0 · Individual KYC on device end to end

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Unverified member; real-looking test ID images; staff reviewer in admin.

**Steps:**

1. Profile > Verification (or Start > 'Review eligibility') > identity verification.
2. Step 1: read the data-use notice and Privacy Policy link; pick a DOB making the user 17 (should be impossible) then 30; Nationality; ID number.
3. Step 2: switch document type to passport (back side hidden) and back; upload front/back via Camera and Choose file.
4. Step 3: GhanaPost GPS path and document path (utility bill PDF); tap 'View private document'.
5. Step 4: selfie; try Submit before ticking the acknowledgement; tick and submit.
6. Staff rejects with an information request; respond from Verification; staff approves.

**Expect:** DOB picker blocks under-18 dates; validation messages per step; Continue disabled while uploads run. Private documents open via short-lived signed URL (link should not work after expiry or signed out). Submit requires acknowledgement; success shows 'Verification submitted' > 'View verification status'. Status transitions and information-request responses work; approval unlocks campaign creation. Snackbar errors dismissible.

**Needs:** Private KYC storage/Cloudinary, admin console

**Source:** `apps/mobile/app/kyc.tsx`, `apps/mobile/app/verification.tsx`, `apps/mobile/src/components/KYCInformationHistory.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/lib/kyc.ts`

## MOBILE-067 · P0 · Android 14+ screen sharing foreground service (Play FGS declaration evidence)

*Surfaces:* android  ·  *Type:* compliance

**Before:** Signed release build on Android 14, 15 and 16 devices. A live session running as host.

**Steps:**

1. Tap 'Share screen' and deny the system capture prompt. Record the exact error text and any button shown.
2. Tap again and accept. Choose the entire screen, then a single app (Android 14+ app selection).
3. Pull down the shade and check the ongoing notification. Switch to another app for 30 s and speak.
4. Tap 'Stop sharing'. Share again and stop from the system notification or status-bar chip. Repeat for 3 sessions.
5. Record a short video of Go live > Share screen > prompt > notification > Stop for the Play declaration.

**Expect:** Deny: no capture, no crash, a readable error. The same error handler serves camera and mic, so if a declined capture prompt shows 'Camera or microphone access is off. Open Settings to allow it, then turn the device on.' with an 'Open Settings' button, log a copy defect: screen capture is granted per session, not in Settings. Accept: viewers see the screen, a service notification is visible while sharing, the enabled mic keeps working, and other apps' audio is not captured ('Other apps’ audio is not included'). Stopping, in the app or through system revocation, ends capture and the notification, and repeated sessions work.

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app.json`, `apps/mobile/STORE_SUBMISSION.md`

## MOBILE-083 · P0 · Android 16 KB page-size device: install, launch and native-heavy paths

*Surfaces:* android  ·  *Type:* cross-platform

**Before:** Android 15/16 16 KB system image emulator (compatibility mode off) and/or Pixel 8+ with 'Boot with 16KB page size'; confirm with adb shell getconf PAGE_SIZE = 16384; release APK/AAB.

**Steps:**

1. Install and cold launch; browse Home with many images (Fresco decoding).
2. Sign in; enable biometric unlock; lock/unlock.
3. Upload a camera photo; pick a PDF.
4. Go live as host and watch as viewer (LiveKit WebRTC, noise filter); share screen.
5. Open Subscription (IAP), Paystack tab, date picker; run 15 minutes of mixed use.
6. Collect adb logcat for SIGSEGV/SIGBUS and 'page size' warnings.

**Expect:** No crash, no native fault, no 'app not compatible/16 KB' dialog. All flows work as on 4 KB devices. Any crash in RN/Hermes/JSI, libc++, fbjni, Fresco, AndroidX graphics or LiveKit libs is a release blocker for those devices and must be tracked against the 1 Feb 2027 Play deadline.

**Needs:** LiveKit, Play Billing test

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/plugins/withAndroidPageAlignment.js`, `apps/mobile/plugins/withAndroidDataStore.js`, `docs/compliance/NATIVE_PERMISSIONS.md`

## MOBILE-N001 · P0 · Minimum-version 'Update required' gate blocks outdated store builds

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Release builds at version 1.0.0 (app.json) on iOS and Android. A staging API where ops can set MIN_APP_VERSION_IOS, MIN_APP_VERSION_ANDROID, APP_STORE_URL_IOS and APP_STORE_URL_ANDROID and redeploy.

**Steps:**

1. With both MIN_APP_VERSION_* unset, call GET https://<api>/api/v1/app/config and cold-launch both apps.
2. Set MIN_APP_VERSION_ANDROID=1.0.1 and leave iOS unset. Redeploy and cold-launch both apps.
3. On Android, tap 'Update Ujimora'.
4. Set MIN_APP_VERSION_IOS=1.0.1 with APP_STORE_URL_IOS unset. Launch iOS and tap 'Update Ujimora'. Then set APP_STORE_URL_IOS=https://apps.apple.com/app/id<id>, relaunch and tap again.
5. While the gate is showing, try to reach the app: VoiceOver/TalkBack swipes, Android back, ujimora://settings, and an account with biometric lock on.
6. Set the minimum to 1.0.0, and separately to 1.0, then relaunch. With the gate showing, lower the minimum, background the app for more than 5 minutes and resume.

**Expect:** With nothing set, the response is {data:{minSupportedVersion:{ios:null,android:null}, storeUrls:{ios:null, android:'https://play.google.com/store/apps/details?id=com.ujimora.app'}}} with Cache-Control 'public, max-age=300', and no gate appears. With a higher minimum, the platform shows a full-screen 'Update required' with the Ujimora logo, reading: 'This version of Ujimora (1.0.0) is no longer supported. Update to version 1.0.1 or later from Google Play (the App Store on iOS) to keep using your account, donations and campaigns.' 'Update Ujimora' opens the Play listing. On iOS it opens the configured App Store URL, or the App Store app when none is set. If the store cannot be opened: 'Could not open Google Play. Search for Ujimora there to update.' The other platform is unaffected. The gate sits above everything, including the biometric lock. Screen readers and deep links cannot reach content behind it. An equal version (1.0.0 or 1.0) shows no gate. After the minimum is lowered, the gate clears on the next check (resume at least 5 minutes after the last check) or on relaunch.

**Needs:** Staging API deploy access (Render env vars), App Store / Play listings

**Source:** `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/mobile/src/lib/appUpdate.ts`, `apps/mobile/app/_layout.tsx`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/appConfigRoutes.ts`, `apps/api/.env.example`

## MOBILE-N003 · P0 · Report Campaign dialog (signed in) reaches the moderation queue

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** User A signed in, viewing an active campaign owned by user B. Staff with REPORTS permission in admin.

**Steps:**

1. As A, scroll to the bottom of the campaign and tap 'Report Campaign'. Read the dialog and open the Reason picker.
2. Without a reason, check 'Send report'. Type more than 2,000 characters into 'Additional details (optional)'.
3. Choose 'Misleading information', add short details and tap 'Send report'. Double-tap it.
4. Leave and reopen the campaign, then report it again.
5. As B, open your own campaign.
6. Admin: Trust & Safety > Campaign reports. Find A's report and 'Mark reviewed' with a note of at least 20 characters. As A, open the bell.

**Expect:** The dialog 'Report campaign' says 'Reports are reviewed by Ujimora moderators. The campaign creator is not told who reported it. If someone is in immediate danger, contact local emergency services.' The reasons are Fraudulent activity, Misleading information, Inappropriate content, Spam, Illegal activity, Intellectual property or copyright, Privacy violation and Other. 'Send report' stays disabled until a reason is chosen, and details stop at 2,000 characters. Success replaces the button with 'Thank you. Our team will review this campaign.' and creates one report (201). A repeat shows 'You have already reported this campaign' inside the dialog. B sees no Report Campaign on their own campaign. The report appears in admin Campaign reports with the reason and the campaign link. After review, A's inbox gets 'We reviewed your report' / 'Thank you for reporting this campaign. Our team has reviewed it and taken the action it considers appropriate.'

**Needs:** Admin campaign reports page

**Source:** `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/lib/campaignReport.ts`, `packages/types/src/campaign.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/application/use-cases/ReportCampaignUseCase.ts`, `apps/api/src/application/use-cases/ReviewReportUseCase.ts`

## MOBILE-005 · P1 · First launch and cold start with no network or API down

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Release build. Ability to enable airplane mode and to block the API host: a proxy map-remote that returns a 503 HTML page, and a black-hole rule that never responds.

**Steps:**

1. Fresh install. Enable airplane mode and launch.
2. On Home, tap 'Try again' under 'Could not load campaigns'. Open Explore.
3. Disable airplane mode and tap Try again.
4. Make the API host return a 503 HTML page. Go to Sign In, enter valid credentials and tap Sign In.
5. Make the API hang (no response). Open Explore, a campaign and Sign In, and time how long each takes to show an error.
6. Open Profile > All policies while offline.

**Expect:** No crash. Offline, Home shows 'Could not load campaigns' with 'Could not reach Ujimora. Check your connection and try again.' and a 'Try again' button, and it recovers once the network is back. Legal pages render offline. Sign In against the HTML 503 shows 'Ujimora is temporarily unavailable. Please try again in a minute.' and never a raw 'JSON Parse error'. A hanging API gives up after 30 s with 'Ujimora took too long to respond. Check your connection and try again.', and buttons and navigation work again. No spinner stays up for good. Explore: log a defect if an offline or failed load shows '0 campaigns' and 'No campaigns found' instead of an error. The Explore screen does not render useCampaignSearch errors.

**Needs:** Proxy tool

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/explore.tsx`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/src/components/LegalScreen.tsx`

## MOBILE-006 · P1 · Upgrade install preserves session, preferences, biometric lock and pending payments

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** Previous release/TestFlight build N and new build N+1 (same bundle id). Test account signed in on build N with dark mode + Glass skin; on Android a pending (unpaid) donation checkout started; a second device/account with biometric unlock enabled.

**Steps:**

1. On build N: sign in, set Appearance Dark and Design finish Glass, start an Android donation and leave checkout unpaid (Awaiting payment confirmation).
2. Install build N+1 over it via TestFlight / Play internal track without uninstalling.
3. Launch; observe auth state, theme, skin.
4. Open the same campaign's Donate screen.
5. Repeat with biometric unlock enabled on build N.

**Expect:** User remains signed in (tokens in SecureStore; any legacy AsyncStorage token migrated and removed). Theme and skin persist. The donate screen shows the saved PaymentStatus for the pending attempt instead of a fresh form. With biometrics enabled the app opens to 'Ujimora is locked' and unlocks with biometrics. No duplicate payments created.

**Needs:** TestFlight / Play internal testing, Paystack test keys

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/context/ColorModeContext.tsx`

## MOBILE-007 · P1 · Reinstall and device restore behavior (iOS keychain survival, Android no backup)

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Account with biometric unlock enabled on iPhone; Android device with Google backup enabled.

**Steps:**

1. iOS: enable biometric unlock, delete the app, reinstall from TestFlight, launch.
2. If a lock screen appears, tap 'Unlock with biometrics', then 'Sign in with password instead'.
3. Android: sign in, trigger a Google backup (adb shell bmgr backupnow com.ujimora.app), uninstall, reinstall, launch.
4. Android: perform a device-to-device transfer to a second phone if available.

**Expect:** iOS: no crash; either the sign-in/Home state or a lock screen whose biometric unlock fails with 'Saved account information is unavailable. Sign in with your password.' and password fallback clears the stale vault. No previous-user data displayed. Android: app starts signed out; no tokens, pending payments or preferences restored from backup/transfer.

**Needs:** None external

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/plugins/withPrivateBackupRules.js`

## MOBILE-008 · P1 · Custom-scheme deep link route table, cold and warm start

*Surfaces:* android, ios  ·  *Type:* functional

**Before:** Release build; test data: campaign id + slug, active live session id, organization id, creator handle, own donation id. Links fired via Notes/Messages tap (iOS) and adb shell am start -a android.intent.action.VIEW -d '<url>' (Android).

**Steps:**

1. With the app killed, open each: ujimora://campaigns/<id>, ujimora://c/<slug>, ujimora://c/<slug>/live/<sessionId>, ujimora://live/<sessionId>, ujimora://organizations/<id>, ujimora://creators/<handle>, ujimora://campaigns (Explore), ujimora://profile, ujimora://donations, ujimora://refunds, ujimora://subscription/callback, ujimora://legal and every slug (terms, privacy, delete-account, organizer-agreement, contributor-terms, refund-policy, acceptable-use, cookies, billing-terms), ujimora://login, ujimora://campaigns/new.
2. Repeat each with the app already open on another screen (warm).
3. Press back after each.

**Expect:** Each link lands on the matching screen (campaign detail, shared-slug resolver then campaign, live viewer, organization, creator page, Explore tab, Profile tab, My Donations, My Refunds, Subscription, legal pages, Sign in, Start a campaign) in both cold and warm starts, with a sensible back target (Home when cold). No double navigation or blank screen.

**Needs:** Staging data

**Source:** `apps/mobile/app/+native-intent.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/src/navigation/deepLinks.ts`, `apps/mobile/app/campaign/shared.tsx`

## MOBILE-010 · P1 · Referral deep link pre-fills the referral code on registration

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An affiliate account with a referral code (from Profile > Affiliate). The app is signed out.

**Steps:**

1. Open ujimora://register?ref=<CODE> from a Notes tap (iOS) or adb am start (Android), once cold and once warm.
2. Check the 'Referral code (optional)' field.
3. Open ujimora://?ref=<CODE> (the site-root referral link form) and ujimora://login?ref=<CODE>, then tap 'Create one'.
4. Complete registration. In the affiliate account, check Referrals.
5. Register another new account after typing an invalid code: too short (e.g. 'ab'), with invalid characters (e.g. 'bad code!'), and a reserved code.
6. Tap https://app.ujimora.com/register?ref=<CODE> from Notes or WhatsApp.

**Expect:** ujimora://register?ref= and ujimora://?ref= both open Register with the field pre-filled and editable, and the referral is attributed after sign-up. For an invalid code, the hint under the field shows the problem (e.g. 'Use at least 3 characters.', 'Use letters and numbers, with single hyphens between them.', 'That code is reserved. Try another.') followed by 'Until it is fixed, you will sign up without a referral code.' Registration still succeeds, without a referral, and never gets a 400. Manually typing a valid code works. The https link opens the website, where the web app captures ?ref. Known open issue I025: the web RegisterForm guard, event-QR ?ref labels and marketing ?ref forwarding are still open. There are no App Links either (I152).

**Needs:** Affiliate program enabled

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/lib/referral.ts`, `packages/types/src/referralCode.ts`

## MOBILE-011 · P1 · Unknown, malformed and dev-client links are handled safely

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Release build.

**Steps:**

1. Open ujimora://this/does/not/exist.
2. Open ujimora://campaigns/%E0%A4%A and ujimora://campaigns/' OR 1=1.
3. Open ujimora://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081.
4. Open ujimora://campaigns/<nonexistent-24-hex-id>.
5. On the not-found screen tap 'Go Home'.

**Expect:** Unknown paths show 'Lost in the journey?' with Go Home returning to Home. Malformed ids show 'Campaign not found'/error text, never a crash or raw stack. Dev-client link opens Home. No request is sent to any host other than the API.

**Needs:** None

**Source:** `apps/mobile/app/+not-found.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/campaign/[id].tsx`

## MOBILE-013 · P1 · Deep link arriving while biometric-locked or signed out

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Account with biometric unlock enabled. The app is locked: either backgrounded for more than 60 s or locked with Settings > 'Lock now'.

**Steps:**

1. With the app locked in the background, open ujimora://my-donations.
2. Look at the lock screen, then tap 'Unlock with biometrics'.
3. Kill the app. Open ujimora://settings (cold start, locked) and unlock.
4. Sign out. Open ujimora://settings, tap 'Sign In' on the 'Sign in to continue' gate, and sign in.
5. Repeat the last step, but tap 'Create one' on the login screen and register a new account instead.

**Expect:** The lock screen appears first, and no private content or screen title shows behind it, including with VoiceOver/TalkBack. After unlock the app shows a consistent screen, with no replayed or duplicate navigation and no content flash before the lock. Signed out, the gate reads 'Sign in to continue' / 'Sign in to view your settings.'. After sign-in, and also after registering from the linked 'Create one', the app returns to Settings instead of Home. Pressing back from there does not go back to the sign-in screens.

**Needs:** Biometric-capable physical device

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/navigation/returnTo.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`

## MOBILE-014 · P1 · Payment callback link verifies with the server and never trusts the URL

*Surfaces:* android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Android donation intent created (known intent id and reference uf-<intentId>-<8hex>).

**Steps:**

1. Open ujimora://donate/callback?reference=uf-<intentId>-<8hex> before paying.
2. Complete the payment in Paystack test mode, then reopen the link.
3. Open ujimora://donate/callback?reference=garbage and ujimora://donate/callback with no params.
4. Open ujimora://donate/callback?reference=uf-<someone-elses-intent>-deadbeef.

**Expect:** Valid reference shows 'Awaiting payment confirmation' until the server verifies, then 'Thank you for your support'. Garbage/no reference shows 'Return to your donation' with Explore campaigns. Another user's reference reveals no donor PII (only status). Success is never shown without server confirmation.

**Needs:** Paystack test keys, webhook delivery to staging

**Source:** `apps/mobile/app/donate/callback.tsx`, `apps/mobile/src/components/PaymentStatus.tsx`

## MOBILE-017 · P1 · Photo library and document picking without broad storage permissions; size and type limits

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Test files on device: 1 MB JPEG, 5 MB JPEG, PDF under 4 MB, HEIC photo, PNG, WebP.

**Steps:**

1. Edit profile > Profile photo 'Add' (library); observe whether any Photos/Media permission prompt appears.
2. iOS: with Photos set to 'Limited', pick an allowed and a non-allowed photo.
3. KYC 'Front of your ID' > 'Choose file': pick the PDF, then the 5 MB JPEG, then the HEIC.
4. Campaign cover: pick an image, then 'Remove', then 'Replace'.
5. Cancel the picker mid-way.

**Expect:** Android uses the system photo picker with no READ_MEDIA prompt; iOS uses the system picker (no full-library access needed). PDF accepted for document fields and shown as 'Uploaded' with 'View private document' for KYC. Files over 4 MB show 'Choose a file smaller than 4 MB.' HEIC is either converted or not selectable - no silent failure. Cancelling leaves state unchanged and busy indicator clears.

**Needs:** Cloudinary / private KYC storage

**Source:** `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/app.json`

## MOBILE-018 · P1 · KYC 'Use my location' one-shot permission matrix

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Member account on KYC step 3 'Address verification'. Location permission not yet asked.

**Steps:**

1. Tap 'Use my location' and read the prompt. Choose Allow Once (iOS) or Only this time (Android).
2. Check that Country, State, City and Street fill in, then edit one field by hand.
3. Reset the permission and choose Don't Allow, then tap 'Use my location' again. On Android, deny a second time.
4. When 'Open Settings to allow location' appears, tap it, allow While Using, return and tap 'Use my location' again.
5. Android: choose Approximate location, then tap again.
6. Turn Location Services off globally and tap again.
7. After the flow, check iOS Settings > Privacy > Location Services > Ujimora and Android App info > Location.

**Expect:** The prompt shows 'Use your location to fill your verification address.' with When-In-Use / one-time options only, never Always or background. Address fields fill and stay editable; choosing Ghana sets the GhanaPost option. An Android denial while the OS can still ask shows 'Location permission was declined. You can choose your address manually.' with no button. Once the OS will not prompt again (iOS after any denial; Android after the second denial or 'Don't ask again'), the app shows 'Location access is off for Ujimora. Open Settings to allow it, or choose your address manually.' and an 'Open Settings to allow location' button that opens the app's settings page. After allowing, the fill works and the button disappears. Approximate location still fills at least country/region. With services off the app shows an error, with no crash and no endless spinner. No location indicator remains after leaving the screen.

**Needs:** Device geocoder (network)

**Source:** `apps/mobile/app/kyc.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/plugins/withForegroundLocationOnly.js`, `apps/mobile/app.json`

## MOBILE-019 · P1 · Live broadcast camera/microphone permissions for host; viewer never prompted

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Campaign owner on a plan with live streaming, LIVEKIT_* configured, permissions never asked. A second device as viewer.

**Steps:**

1. Owner: campaign detail > Go live > Create live session > 'Start camera and microphone'.
2. Deny camera and microphone at the prompts.
3. Tap the 'Open Settings' button, grant both in Settings and return. Tap 'Disconnect camera', then 'Start camera and microphone' again, then toggle 'Camera on' / 'Unmute'.
4. Viewer: open the live link and tap 'Watch broadcast'.

**Expect:** The host sees camera and microphone prompts with the live-broadcast purpose strings. Denial shows 'Camera or microphone access is off. Open Settings to allow it, then turn the device on.' with an 'Open Settings' button that opens Ujimora's system settings page. No crash. The button and message clear on the next attempt. After granting, video and audio publish. The viewer is never prompted for camera or microphone and sees 'Join as a viewer. Your camera and microphone remain off.'

**Needs:** LiveKit credentials, store/plan with liveStreaming

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/components/OpenSettingsButton.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/app/live/[sessionId].tsx`

## MOBILE-021 · P1 · OS permission list matches declared data use (App Privacy / Data safety)

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Device that has completed MOBILE-016..019 flows.

**Steps:**

1. iOS Settings > Ujimora: list every toggle shown.
2. Android App info > Permissions: list allowed/not allowed and 'Other app permissions'.
3. Compare with docs/compliance/STORE_DATA_INVENTORY.md and console answers.

**Expect:** iOS shows only Camera, Microphone, Location (While Using/Never/Ask), Face ID and possibly Photos (limited) - no Notifications, Local Network, Bluetooth or Tracking. Android shows Camera, Microphone, Location only; no Notifications, Photos and videos, Nearby devices unless justified and declared.

**Needs:** None

**Source:** `apps/mobile/app.json`, `docs/compliance/STORE_DATA_INVENTORY.md`, `docs/compliance/NATIVE_PERMISSIONS.md`

## MOBILE-025 · P1 · Forgot password end-to-end from the app

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** An existing account with an accessible mailbox, plus an unknown email. A proxy to return 503 from the API.

**Steps:**

1. Sign In > 'Forgot password?'. Enter the account email and tap 'Send Reset Link'.
2. Open the email on the phone and tap the reset link.
3. Reset the password on the web page, return to the app and sign in with the new password.
4. Repeat with an unknown email.
5. Repeat with airplane mode on, with the API returning 503, and after more than 30 rapid requests from the same device/network.

**Expect:** Known and unknown emails get the same neutral 'Request received' message, so accounts cannot be enumerated. The reset link opens the web reset page (there is no native reset screen) and works in mobile browsers. The old password no longer works in the app, and existing app sessions are revoked per server policy. Airplane mode shows "Can't reach Ujimora. Check your connection and try again." An API 5xx shows 'Password recovery is temporarily unavailable. Please try again later.' When rate limited (429, now counted per device IP): 'Too many attempts. Please wait about 15 minutes and try again.' An email the API rejects (400): 'Enter a valid email address.'

**Needs:** Email provider

**Source:** `apps/mobile/app/forgot-password.tsx`, `apps/mobile/src/lib/authMessages.ts`, `apps/mobile/src/lib/api.ts`

## MOBILE-028 · P1 · Biometric lock interaction with system prompts and external sheets (form state preservation)

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** Biometric unlock enabled, permissions not yet granted, Android Paystack test mode, IAP sandbox, MFA enabled so recovery codes can be replaced.

**Steps:**

1. KYC step 1: fill Full name and ID number. On step 3, tap 'Use my location' so the OS permission alert appears and answer it, then tap Back to step 1.
2. Start a campaign step 2: type a story, tap Camera for the cover, spend about 2 minutes in the camera, then take a photo.
3. On the Android donate form with text entered, pull down the notification shade (iOS: Control Center), then dismiss it.
4. Settings > Authenticator > replace or download recovery codes. Keep the share sheet open about 2 minutes, then save.
5. Android: start a donation so Paystack opens in a browser tab. Pay and return within 60 s. Repeat, staying longer than 2 minutes before returning.
6. Start an IAP subscription so the store sheet appears. Complete it quickly, and on Android also once taking more than 60 s.

**Expect:** Steps 1-4: the app never asks for biometric unlock. While the OS UI is up, the app shows a cover, then returns to the same screen with the typed KYC and story text, the uploaded cover and the recovery codes intact. The camera, picker, location permission and recovery-code share get a 10-minute allowance. Steps 5-6: returning within 60 s keeps the session unlocked. After more than 60 s in the Paystack tab or the Play billing activity, the app asks for unlock. After unlock, Donate shows the saved PaymentStatus and polling reconciles the payment, and Subscription silently restores and verifies the purchase. After a real lock, screens remount: Start a campaign restores its saved draft, while unsaved KYC text is lost (expected). Log a P1 defect if a draft is lost within these limits, or if a payment or purchase result is missing after unlock. The grace and hand-off policy needs owner sign-off (I092).

**Needs:** Paystack test keys, App Store/Play sandbox

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/src/components/MfaSettings.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## MOBILE-029 · P1 · Biometric unlock after enrollment change, offline, or revoked refresh token

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Biometric unlock enabled on the device. Ability to change the password on the web. A proxy that can black-hole the API.

**Steps:**

1. Add a new fingerprint or face (or reset Face ID) in OS settings. Return to Ujimora, tap Settings > 'Lock now' (or background for more than 60 s), then tap 'Unlock with biometrics'.
2. Sign in with your password and turn biometric unlock back on. Lock now, turn on airplane mode, then tap Unlock.
3. Back online, make the API hang (black-hole) and tap Unlock. Wait 15 s.
4. Restore the API and change the password on the web. On the phone, Lock now, then tap Unlock. Tap Unlock a second time.
5. Tap 'Sign in with password instead'.

**Expect:** Changed enrollment: 'Biometric access changed or expired. Sign in with your password instead.' (or 'Biometrics are unavailable or changed. Sign in with your password instead.'), and no access. Airplane mode: after the biometric prompt, 'Could not unlock. Try again, or sign in with your password and authenticator if enabled.' Retry works once online. Hung API: after about 15 s, 'Unlock could not reach Ujimora. Try again or use password sign-in.' Revoked credential after the web password change: 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.' The vault is cleared, so the second Unlock shows an error without an OS biometric prompt. Password sign-in works, and stale credentials never grant access.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/unlockError.ts`, `apps/mobile/src/components/BiometricLock.tsx`

## MOBILE-030 · P1 · Enable authenticator MFA on the same phone (no second screen to scan)

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Account without MFA. An authenticator app (Google Authenticator/Authy/1Password) on the same phone. Run once with biometric unlock OFF and once ON.

**Steps:**

1. Settings > Authenticator protection: enter the Current password and tap 'Set up authenticator'.
2. Tap 'Copy setup key', switch to the authenticator, add the key and copy the 6-digit code.
3. Return to Ujimora within 60 s, paste into the OTP input and tap 'Confirm and enable MFA'.
4. Biometrics ON: start setup again on another account, and this time stay in the authenticator app for more than 60 s before returning.
5. Also test scanning the QR from a second device, and 'Cancel setup'.
6. Wait more than 10 minutes after setup before confirming.

**Expect:** Biometrics off: the setup state (QR, key) survives the app switch. Confirming enables MFA and shows 10 recovery codes with 'Authenticator protection enabled. Save your recovery codes now. Other sessions have been signed out.' Biometrics on: returning within 60 s keeps the QR and key on screen with no unlock. If the switch lasts more than 60 s, the app asks for biometric unlock and the setup screen resets, so setup has to be started again. That is expected under the 60 s grace policy, which needs owner sign-off (I092). An expired setup shows 'Setup expired or changed. Start authenticator setup again.' Cancel does not enable MFA.

**Needs:** MFA_ENCRYPTION_KEY

**Source:** `apps/mobile/src/components/MfaSettings.tsx`, `apps/mobile/src/lib/session.ts`

## MOBILE-031 · P1 · Recovery codes copy, download via share sheet, cancel and cleanup

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** MFA just enabled (codes displayed) or use 'Replace recovery codes' with password + current code. Debug/inspectable build for cache check (Xcode container download or adb run-as).

**Steps:**

1. Tap 'Copy recovery codes'; paste into Notes to verify exact 10 codes.
2. Tap 'Download recovery codes'; in the share sheet choose Save to Files (iOS) / Drive or Files (Android); open the saved file.
3. Tap Download again and cancel the share sheet.
4. Inspect the app cache directory for ujimora-recovery-codes-*.txt; relaunch app and re-inspect.
5. Tap 'I have saved my codes'.

**Expect:** Clipboard contains exactly the codes; message 'Copied. Keep this information private.' Saved file contains the header and the codes. Temporary file is deleted after the sheet closes (success or cancel) and any leftover is removed at next launch. 'I have saved my codes' hides them and they are never shown again (status shows remaining count only).

**Needs:** None

**Source:** `apps/mobile/src/lib/recoveryCodes.ts`, `apps/mobile/src/components/MfaSettings.tsx`, `apps/mobile/app/_layout.tsx`

## MOBILE-032 · P1 · 60-minute idle expiry with and without biometric lock

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Signed-in account; one device with biometrics off, one on. (Optionally a debug build with IDLE_MS reduced.)

**Steps:**

1. Leave the app idle in foreground for 61 minutes (screen kept awake).
2. Touch the screen / navigate.
3. Repeat by backgrounding for 61 minutes then resuming.

**Expect:** Biometrics off: session ends; protected screens show the Sign In gate; no private data remains visible. Biometrics on: app shows 'Ujimora is locked' and unlock restores the session. Activity within 60 minutes keeps the session alive.

**Needs:** None

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/context/AuthContext.tsx`

## MOBILE-033 · P1 · Token refresh after long background and remote session revocation

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Account signed in on the phone and on web.

**Steps:**

1. Background the app past the access-token lifetime (e.g. 20-30 minutes, under 60); resume and open Wallet.
2. On web, enable/disable MFA or change password (revokes other sessions); on the phone pull a new screen (Wallet, My Donations).
3. Staff suspends the account in admin; phone opens Settings.

**Expect:** After background, requests transparently refresh and succeed. After revocation, the app detects 401/403, ends the session and shows Sign In gates (no crash, no infinite retry, no stale private data). Suspended account cannot continue.

**Needs:** Admin console access

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/api.ts`

## MOBILE-034 · P1 · Change password from Edit profile

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Signed-in account, also signed in on the web. Run once with biometric unlock enabled.

**Steps:**

1. Profile > Edit profile and images > Change password. Enter a wrong current password.
2. Enter mismatched new passwords.
3. Enter the correct current password and matching new passwords, then tap 'Update password'.
4. Keep using the app for 2 minutes (open Wallet, My Donations), then use the web session.
5. With biometric unlock enabled: tap Lock now (or background for more than 60 s), then unlock with biometrics.

**Expect:** A wrong current password shows the API error in the Snackbar. A mismatch shows 'The new passwords do not match.' Success shows 'Password updated', and the phone stays signed in: the new tokens from /auth/change-password replace the old ones, and later requests succeed with no sign-out. The web session and other devices are signed out, because authVersion rotated. Biometric unlock still works because the vault is re-sealed with the new sign-in. If the device cannot store the new sign-in, the app shows 'Password updated, but this device could not save the new sign-in. Sign in again before using biometric unlock.'

**Needs:** None

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/accountSecurity.ts`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`

## MOBILE-036 · P1 · Account agreement re-acceptance for accounts without current legal acceptance

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Legacy account whose legalAcceptance version is older than LEGAL_ACCEPTANCE_VERSION (seed via API/DB).

**Steps:**

1. Sign in; observe the banner 'Review the account agreement before publishing or uploading content.'
2. Try to post a comment or upload a campaign cover before accepting.
3. Tap 'Review agreement'; open each linked policy; tick only one checkbox; then both; tap 'Save agreement'.
4. Relaunch.

**Expect:** Banner shows on every screen until accepted. Publishing/uploads are refused by the API with a clear message before acceptance. Save is disabled until both boxes are ticked; success shows 'Your agreement has been saved.' and the banner disappears and stays gone after relaunch. Deleting the account and reading policies remain possible without accepting.

**Needs:** None

**Source:** `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/mobile/app/account-agreement.tsx`

## MOBILE-045 · P1 · IAP plan change, cancellation, expiry, billing issue and refund

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Active sandbox subscription (accelerated renewal timelines); store server notifications (ASSN v2 / RTDN) reaching staging.

**Steps:**

1. Switch to Yearly or a higher tier via 'Change plan'.
2. Tap 'Manage ... subscription' and cancel auto-renew in store settings; return and Refresh.
3. Let the sandbox period expire; reopen the screen.
4. Trigger a billing-retry/grace state (Apple sandbox or Google test) and a refund/revoke.
5. Delete the Ujimora account while subscribed (after MOBILE-047) and check store status.

**Expect:** Plan change goes through the store with proration (Google) / same-group upgrade (Apple); new tier reflected after verification; a cross-group Apple change is blocked with 'Manage the existing subscription in App Store settings...'. Cancellation shows 'Automatic renewal is off.' and access continues to period end. Expiry/refund revokes paid features. Billing issue shows 'Your subscription needs attention...'. Account deletion does not cancel the store subscription (as disclosed).

**Needs:** App Store Server Notifications, Google RTDN Pub/Sub

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/mobile/src/lib/storeBilling.ts`, `docs/compliance/STORE_BILLING.md`

## MOBILE-046 · P1 · Store catalog disabled and web-billed (foreign provider) accounts

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Environment A with STORE_BILLING_ENABLED=false; account C with an active web Paystack subscription.

**Steps:**

1. Env A: open Profile > Subscription.
2. Account C: open Profile > Subscription on iOS and Android.
3. Account C: try Restore purchases.

**Expect:** Disabled billing: 'New store purchases are temporarily unavailable. Your existing plan and free features remain available.' and no Paystack fallback. Account C: 'This account manages its subscription through another billing service...'; no Subscribe buttons; no link to web billing; no duplicate subscription possible.

**Needs:** Paystack (web subscription), store sandbox

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## MOBILE-051 · P1 · Report/comment controls when signed out

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Signed-out app. A campaign (not your own) with comments, updates and donor messages.

**Steps:**

1. Open campaign detail and scroll to comments, updates and recent donations.
2. At the bottom, tap 'Sign in to report this campaign' and sign in.
3. Back on the same campaign, tap 'Report Campaign'.
4. Signed out again, try to post a comment.

**Expect:** Report buttons on comments, updates and donations are hidden when signed out, and comments show 'Sign in to join the conversation.' Signed out, the campaign report control reads 'Sign in to report this campaign' and opens Sign In. It sends no report, because the API requires sign-in. After sign-in the app returns to the same campaign, where 'Report Campaign' opens the report dialog (see MOBILE-N003).

**Needs:** None

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/src/navigation/returnTo.ts`

## MOBILE-052 · P1 · AI writing assistant requires explicit consent per request

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** OpenAI configured (ai-writing enabled) and a second environment where it is disabled; campaign create step 2.

**Steps:**

1. Type a story; confirm 'Generate preview' is disabled until the consent checkbox is ticked.
2. Tick consent, generate; confirm consent unticks after the request.
3. Edit the story after preview; try 'Apply to story'.
4. Use 'Discard'; use the in-preview Report.
5. Exhaust daily requests; test the disabled environment and API offline ('Retry connection').

**Expect:** No text is sent before consent (verify via proxy). Preview shows result; Apply disabled with 'Your story changed...' if edited. Remaining request count decrements; zero disables Generate. Disabled env shows 'Writing assistance is not currently available.' Privacy policy link opens ujimora.com/privacy.

**Needs:** OpenAI API key

**Source:** `apps/mobile/src/components/AiWritingAssistant.tsx`, `apps/mobile/app/campaign/create.tsx`

## MOBILE-057 · P1 · Android donation abandonment, failure and retry

*Surfaces:* android, api  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys, including a declined test card. Staging reconciliation sweep enabled, or the ability to run it.

**Steps:**

1. Start a donation, then close the browser tab without paying.
2. Read the 'Awaiting payment confirmation' card. Tap 'Open secure checkout' and pay with a declined card.
3. Wait for the final state, then tap 'Try again'.
4. Start another donation and abandon it. Keep the Donate screen open (or relaunch it) until 15 minutes have passed, then tap 'Start a new payment'.
5. Leave a third abandoned checkout for more than 24 h (or let the sweep run on an intent older than 24 h). Reopen Donate or tap 'Check status'.
6. Corruption test: in a debug build, write invalid JSON to the pending key and reopen Donate.

**Expect:** While pending, the card shows 'Your balance updates only after provider confirmation. Closing checkout does not confirm or cancel a payment.' A declined payment ends at 'Payment was not completed' with 'Try again', which clears the saved attempt and shows a fresh form with a new idempotency key. After 15 minutes unconfirmed, the card adds "Still not confirmed? If you already paid, don't pay again: that payment will still be confirmed once the provider reports it." and a 'Start a new payment' button that opens a fresh form. After 24 h the server expires an abandoned Paystack checkout and releases any fee-waiver seat, and the app shows 'Payment was not completed' (Status: EXPIRED). A genuine late payment on an expired intent is still credited once. Corrupted saved state shows 'Your saved payment could not be read. Check your payment history or contact support before trying another payment. The saved attempt has been preserved.' and blocks a new payment instead of risking a duplicate.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`

## MOBILE-058 · P1 · Donation during a live session is attributed to the session (Android) and handed off with context (iOS)

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** An active live session with a session goal set by the host. A viewer device.

**Steps:**

1. Viewer: on the live page, read the totals card and the session goal line.
2. Viewer: tap 'Support this campaign' and donate 20 GHS (Android), or continue in the browser (iOS).
3. Host: watch the studio stats ('GH₵… · N donations') and the OBS overlay. Replay the webhook.
4. Viewer: open Donate from the live page, then have the host end the session, then pay within 30 minutes.
5. After the session ends, tap 'Support this campaign' on the same page and donate.

**Expect:** The live page shows 'Session goal: GHS <goal> · N% reached'. The percentage is left out when the host hides amounts. The Android donation carries liveSessionId, and the session's amountRaised and successfulDonations go up exactly once after confirmation, even after a webhook replay. The overlay follows the privacy toggles. The iOS Safari URL carries liveSessionId while the session is active, and the web donation is attributed. A checkout opened during the live session and paid within 30 minutes after it ends is still attributed to the session. 'Support this campaign' tapped after the end opens Donate without liveSessionId, so the donation goes to the campaign only. A bad or stale session id never blocks a donation.

**Needs:** LiveKit, Paystack test keys

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/lib/fundraising.ts`

## MOBILE-060 · P1 · Crypto option appears only when the server enables it

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Environment with CRYPTO_PAYMENTS_ENABLED=false and one with true (Bitnob sandbox, at least one asset).

**Steps:**

1. Disabled: open Android Donate; open Payment method list.
2. Enabled: select 'Crypto · supported assets and networks'; choose asset/network; 'Get quote'; 'Accept quote and get address'; 'Copy address' and 'Copy memo / tag'.
3. Let the quote expire; request again.
4. iOS: confirm no crypto UI in-app in either environment.

**Expect:** Disabled: no crypto option (never shown as an uncompletable choice). Enabled: quote in GHS, address and memo copyable exactly; expired quote refreshed; status maps AWAITING_PAYMENT -> PENDING_CONFIRMATION -> CONFIRMED. iOS never shows crypto (web only).

**Needs:** Bitnob sandbox

**Source:** `apps/mobile/src/components/CryptoContribution.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`

## MOBILE-061 · P1 · Refund request from My Donations and My Refunds status

*Surfaces:* admin, android, api, email, ios  ·  *Type:* functional

**Before:** A donor with: a completed card or mobile-money donation under 30 days old, a completed wallet-funded donation, a donation over 30 days old, and a donation that already has an open refund request. Staff access to the admin Refund requests page.

**Steps:**

1. Profile > My Donations. Note which rows show 'Request Refund'.
2. Tap 'Request Refund' on the eligible donation. Submit without a reason (the 'Select a Reason' alert appears), choose a reason, add details and submit. Double-tap submit.
3. Open My Refunds. Staff moves the request through Approve, then Mark refunded (or Decline) with a note of at least 20 characters. Refresh My Refunds.
4. Open ujimora://donations/refund/<walletDonationId> for your own wallet donation and submit.
5. Open ujimora://donations/refund/<eligibleDonationId> again and submit.

**Expect:** 'Request Refund' appears only on the completed card or mobile-money donation under 30 days old with no open request. Wallet gifts, older gifts and gifts with an open request show none. Status chips read 'Refund in progress' / 'Partially refunded' where relevant. Refund Request shows the campaign, 'GH₵100.50'-style amount and date. One refund is created ('Your refund ID is: …'). A second attempt returns 'Refund already requested for this donation'. The wallet donation returns "Wallet donations can't be refunded automatically. Contact support@ujimora.com with the donation ID." My Refunds shows 'Requested: GH₵…' and each status change. 'Completed' is only possible after the provider refund. The ledger/wallet reversal follows REFUNDS_AND_FEES, and the donor gets one activity alert per status change. Known open issue I125: the apps' 30-day window differs from the API (no window) and from the policy; this is a pending product decision.

**Needs:** Paystack refunds (test), email provider

**Source:** `apps/mobile/app/my-donations.tsx`, `apps/mobile/src/lib/donationRefunds.ts`, `apps/mobile/app/refund-request.tsx`, `apps/mobile/app/my-refunds.tsx`, `apps/api/src/application/use-cases/RequestRefundUseCase.ts`, `docs/compliance/REFUNDS_AND_FEES.md`

## MOBILE-062 · P1 · Campaign cashout from the device: fees, caps and duplicate protection

*Surfaces:* admin, android, api, ios  ·  *Type:* recovery/idempotency

**Before:** A campaign owner with an eligible balance, a verified email and current approved KYC. A verified saved payout account (bank or MoMo). SPLIT_PROCEEDS_ENABLED off for this campaign.

**Steps:**

1. Campaign detail > Manage campaign. Read the eligible balance and 'How your balance is calculated'.
2. Choose standard vs early/urgent types. Enter an amount over the cap, an amount with 3 decimals, '100,50', then a valid amount.
3. Tap submit twice quickly. Kill the app right after tapping, relaunch, and request more than what remains.
4. Choose the 'Ujimora Wallet' destination.
5. Staff blocks the campaign in admin; request again. Staff unblocks it.
6. Use an owner whose KYC has expired, or whose email is unverified, and request.
7. Staff approves in admin; watch the status refresh (30 s poll / resume).

**Expect:** The displayed fee and net match the server ('Fee GHS x; net GHS y'), and the cap is enforced for early/urgent. The amount accepts a decimal comma ('100,50' is 100.50) and rejects more than 2 decimals. A double tap makes one payout (idempotency key). Payouts never exceed eligibility: a request larger than what is left gets 'Cannot request a payout of GHS X; only GHS Y is available for payout (GHS Z is already in pending requests).' A blocked campaign gets 'This campaign is under review; payouts are paused'. An owner without current verification gets 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.' The wallet destination credits the net amount to the GHS wallet after approval. Status moves PENDING -> PROCESSING -> PAID.

**Needs:** Paystack transfers (test), admin console

**Source:** `apps/mobile/src/components/CampaignCashout.tsx`, `apps/mobile/app/campaign/manage.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## MOBILE-064 · P1 · Organization KYC on device

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Organization account (unverified).

**Steps:**

1. Open KYC as the organization; complete the org form uploading registration, authorization and representative identity documents (PDF and camera).
2. Submit; tap 'View verification status'.
3. Staff requests info; respond; staff approves to institutional level.
4. Check organization profile badge.

**Expect:** Organization form (not the individual flow) is shown; uploads obey 4 MB/type limits; submission recorded once. Organization is labelled verified only at institutional verification level.

**Needs:** Private KYC storage, admin console

**Source:** `apps/mobile/src/components/OrganizationKYCForm.tsx`, `apps/mobile/src/lib/organizationKyc.ts`, `apps/mobile/app/organization/[id].tsx`

## MOBILE-065 · P1 · Start a campaign on device: gating, validation, uploads and duplicate protection

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Accounts: an unverified member, a verified member at the plan limit, a verified member with capacity, and a plan with collaboration. SPLIT_PROCEEDS_ENABLED on and off. A proxy that can drop responses.

**Steps:**

1. Unverified: tap the Start tab and 'Review eligibility' (goes to KYC). At-limit account: 'Review eligibility' goes to Subscription.
2. Eligible: step through Basics (a title under 5 characters; confirm there is no summary field), Story (20-5000 characters, beneficiaries), Goal (a goal above the plan limit, a past end date) and Review.
3. Add collaborator emails including an invalid one. Turn on split with shares that do not add up to 100%.
4. Tap 'Create campaign' while the proxy drops the response of POST /campaigns. Tap 'Create campaign' again without changing anything.
5. Repeat with a dropped response, but edit the story before retrying.
6. After creation, set up payout from the inline cashout card and tap 'View campaign'.

**Expect:** Gates route correctly. Basics shows only title and category; a short title gives 'Enter a title of at least 5 characters.' Review has no summary. Each validation message blocks progress, and the cover upload crops at 16:9. POST /campaigns sends an Idempotency-Key. The unchanged retry returns the same campaign, so there is exactly one campaign (pending review) in My Campaigns and admin. An edited retry uses a new key and creates a separate campaign, which is expected because the content changed. Partial failures are listed with 'do not create it again'. The split toggle appears only when canSplit. The saved draft is cleared after creation.

**Needs:** OpenAI (screening), Cloudinary, admin approval

**Source:** `apps/mobile/app/campaign/create.tsx`, `apps/mobile/src/lib/campaignCreationKey.ts`, `apps/mobile/src/lib/publicationDrafts.ts`, `apps/mobile/app/(tabs)/create.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## MOBILE-066 · P1 · Live broadcast host studio lifecycle

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** An owner on a live-streaming plan with LIVEKIT_* configured. An environment without LiveKit for the negative check. OBS or a browser for the overlay.

**Steps:**

1. Without LiveKit: Go live shows 'Live broadcasting is not configured yet.' and Create is disabled.
2. With LiveKit: enter a title and goal (try 0 and abc), tap Create live session, then 'Start camera and microphone'.
3. Toggle Show donor names / Show messages / Show amounts / Privacy mode and check a viewer and the overlay.
4. Tap 'Copy private overlay link' and open it in a browser. Tap 'Replace overlay link' and confirm the old link stops working.
5. Tap 'Share viewer link'. Background the app for 10 s and return; check the camera and mic state.
6. Tap 'End broadcast' and confirm.

**Expect:** The studio reflects session state (10 s poll), and stats read like 'GH₵100.50 · 3 donations'. Toggles apply to viewers and the overlay. Rotation invalidates the old overlay link. The shared viewer link uses the configured web origin (/live/<id>). In the background, camera and mic turn off unless screen sharing is on, and the host turns them back on. This now matches APP_REVIEW_NOTES. 'End broadcast?' / 'This closes the live session for viewers.' ends the session for viewers even if the video provider call fails (the server retries room cleanup), and the host's video token is revoked.

**Needs:** LiveKit, plan with liveStreaming

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

## MOBILE-068 · P1 · iOS screen broadcast via the Broadcast Upload Extension

*Surfaces:* ios  ·  *Type:* functional

**Before:** TestFlight build with UjimoraBroadcast extension; live session as host.

**Steps:**

1. Tap 'Share screen'; system broadcast picker appears; choose 'Ujimora screen broadcast'; Start Broadcast.
2. Leave the app; navigate elsewhere; check viewers.
3. Stop via the red status indicator / Control Center; then 'Stop sharing' in-app.
4. Try on iPad.

**Expect:** Picker lists the Ujimora extension; viewers receive the screen; stopping from either place ends sharing and the UI state syncs. If the picker is not ready, error 'The screen-sharing picker is not ready. Try again.' No crash of the extension under memory limits.

**Needs:** LiveKit

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/plugins/withBroadcastExtension.js`

## MOBILE-069 · P1 · Live viewer experience, ended sessions and network loss

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Active live session; viewer signed out and signed in.

**Steps:**

1. Open the session via ujimora://live/<id>; tap 'Watch broadcast'.
2. Toggle airplane mode for 20 s then restore.
3. Lock the phone and unlock.
4. Tap 'Leave broadcast'; host ends the session; observe viewer.
5. Signed in: Report and Block the host from this page.

**Expect:** Video plays with 'Connection: connected'; recovers or shows a clear disconnected state with a way to rejoin. Audio session stops after leaving. Ended session shows 'This broadcast has ended. You can still support the campaign.' with amounts per privacy settings. Report/Block visible only when signed in and not the host.

**Needs:** LiveKit

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/src/components/LiveVideo.tsx`

## MOBILE-070 · P1 · iPad layouts, orientations and multitasking

*Surfaces:* ios  ·  *Type:* cross-platform

**Before:** iPad (11-inch and 13-inch) with Stage Manager, running the release build (supportsTablet true).

**Steps:**

1. Launch in portrait and in landscape. Rotate on Home, campaign detail, Donate, Settings, KYC, Subscription and the live studio.
2. Use Split View at 1/3, 1/2 and 2/3 and Slide Over, and resize in Stage Manager. Cold-launch once in a narrow Split View to see the splash.
3. Open dialogs (SelectionField, Report, date picker) and the notification sheet at each size.
4. Capture screenshots for the App Store iPad listing.

**Expect:** Supported orientations match the final Info.plist (from MOBILE-001). No clipped or overlapping content; the tab bar stays usable and dialogs stay within bounds. Home carousels resize live on rotation, Split View and Stage Manager resizing: featured cards are 78% of the window width up to 420 pt, small cards 60% up to 320 pt, and snapping follows the new widths. The splash rings size from the current window width. Log any stretched, cut-off or mis-snapping cards. No crash on size changes.

**Needs:** None

**Source:** `apps/mobile/app.json`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/src/lib/layout.ts`, `apps/mobile/src/components/SplashScreen.tsx`, `apps/mobile/src/components/SelectionField.tsx`

## MOBILE-072 · P1 · Large text / display size scaling

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** iOS Larger Accessibility Sizes at max; Android font size max and display size large.

**Steps:**

1. Walk Home, tab bar, campaign detail stats row, Donate button label, PaymentStatus, Wallet balance, Settings, login/register, KYC steps, Subscription plan cards, lock screen.
2. Check dialogs (Report, SelectionField) and the notification strip.

**Expect:** Text scales without truncating critical information (amounts, button labels, legal disclosures) or overlapping; screens scroll to reveal all content; primary actions remain reachable. Record any fixed-height containers that clip (e.g., tab labels at fontSize 10, stats rows).

**Needs:** None

**Source:** `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## MOBILE-073 · P1 · VoiceOver walkthrough of core flows (iOS)

*Surfaces:* ios  ·  *Type:* cross-platform

**Before:** VoiceOver on; release build.

**Steps:**

1. Navigate tabs (announced as tabs with selected state), bell ('Notifications, N unread').
2. Sign in including OTP input and error announcements.
3. Open a campaign; Donate (iOS external screen); Share; Report dialog.
4. Settings: appearance options, biometric switch, MFA; lock screen.
5. KYC selection fields (radio state), date picker, upload buttons; Subscription purchase buttons.

**Expect:** Every control has a meaningful label/role; errors with accessibilityRole alert are announced; decorative images hidden; modal dialogs trap focus; lock screen blocks access to hidden content; no unlabeled icon-only buttons (camera, trash, settings gear).

**Needs:** None

**Source:** `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/components/SelectionField.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`

## MOBILE-074 · P1 · TalkBack walkthrough of core flows (Android)

*Surfaces:* android  ·  *Type:* cross-platform

**Before:** TalkBack on; Android release build.

**Steps:**

1. Repeat MOBILE-073 flows plus Android donation form and Paystack tab return, Wallet top-up.
2. Use TalkBack back gesture in dialogs and multi-step forms.

**Expect:** Same as VoiceOver: labels, roles, alert announcements, dialog focus; hidden content under lock not reachable (importantForAccessibility no-hide-descendants). Payment status changes are announced.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/components/PaymentStatus.tsx`

## MOBILE-076 · P1 · Safe areas, notches and Android edge-to-edge navigation modes

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** iPhone with Dynamic Island, iPhone SE, iPad; Android 15/16 with gesture nav and with 3-button nav; Samsung One UI.

**Steps:**

1. Signed out and signed in (bell strip appears), check top of Home, Dashboard, Profile, Wallet (headerless), stacked screens with headers, login/register.
2. Check the floating tab bar and bottom buttons against the home indicator/nav bar.
3. Open the notifications sheet, Report dialog and Snackbars.
4. Show banners (account agreement, website request) together with the bell strip.

**Expect:** No content under the status bar/notch or behind the nav bar; no double top inset between the bell strip and headers (log if large gap); tab bar clears the home indicator and 3-button bar; Snackbars and sheet close buttons reachable. Banners do not push critical buttons off-screen.

**Needs:** None

**Source:** `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`

## MOBILE-077 · P1 · Keyboard avoidance on every form

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** iPhone SE (small) and Android 14 and 15/16 devices (edge-to-edge). Third-party keyboards (Gboard, SwiftKey).

**Steps:**

1. Focus the bottom-most field on each of these: login, register (referral code), forgot password, Donate (Message, Tip, Fee waiver code), Wallet top-up amount, KYC fields, Organization KYC, Start a campaign story and split rows, Manage campaign cashout amount, the Creator page and its withdrawal dialog, a public creator page, Edit profile password fields, Payout accounts, the comments box, the Report description, Data-rights details and SelectionField search.
2. Type, then scroll. Dismiss the keyboard by tapping outside.
3. Rotate an iPad with the keyboard open.

**Expect:** Focused inputs and the primary action stay visible above the keyboard, and buttons still respond while it is open (keyboardShouldPersistTaps). On Android, login, register, forgot password, Donate, the Wallet tab, KYC, Organization KYC, Start a campaign, Manage campaign, Creator, the public creator page, Edit profile and Payout accounts now pad for the keyboard (KeyboardAvoider offsets by the screen's window position under the header). Log any field on those screens that is still hidden. Known gaps: fields in the creator withdrawal dialog (Portal) are not covered, and neither are dialog or sheet inputs such as the comments box, Report description, Data-rights details and SelectionField search. Log those if hidden. iOS behaviour is unchanged.

**Needs:** None

**Source:** `apps/mobile/src/components/KeyboardAvoider.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app/creator.tsx`, `apps/mobile/app/(auth)/login.tsx`

## MOBILE-078 · P1 · Android back button and predictive back

*Surfaces:* android  ·  *Type:* cross-platform

**Before:** Android 14-16 with gesture and 3-button nav; predictive back animations enabled in developer options.

**Steps:**

1. On Home press back (app should exit/background); from Explore/Profile tabs press back.
2. Pushed screens: campaign detail > Donate > back; Settings > back.
3. Open SelectionField, Report dialog, date picker, notification sheet; press back.
4. KYC step 3 and Start a campaign step 3: press back.
5. On the biometric lock screen press back; then unlock.
6. After Paystack tab / store sheet press back.

**Expect:** Back pops one level or closes the topmost dialog/sheet; tab back returns to Home before exiting. Multi-step forms: back leaves the whole screen and discards the draft - ideally confirm before discarding (log UX gap). On the lock screen back must not reveal or pop hidden screens (verify stack intact after unlock). Custom tab/store sheet back cancels cleanly with correct messages.

**Needs:** None

**Source:** `apps/mobile/app/_layout.tsx`, `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/ReportContent.tsx`, `apps/mobile/src/context/AuthContext.tsx`

## MOBILE-079 · P1 · Share sheets produce correct, working links

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** A campaign with a slug and one without, an organization, a live session, a creator handle and an affiliate account. The production build, plus a build whose EXPO_PUBLIC_WEB_URL points at staging.

**Steps:**

1. Campaign detail > Share: share to WhatsApp and Messages, and Copy.
2. Share from: the organization page, the live viewer ('Share broadcast'), the studio ('Share viewer link'), the creator studio (page link) and the affiliate referral link.
3. Open each shared link on another phone (browser) and on desktop.
4. Repeat the organization, live and studio shares on the staging-configured build.
5. Cancel a share sheet.

**Expect:** Messages contain the title or summary and correct https URLs that open on the web: /c/<slug> or /campaigns/<id>, /organizations/<id>, /live/<id>, /creators/<handle>, and the referral link. Organization, live viewer and studio texts now follow EXPO_PUBLIC_WEB_URL like campaign and creator links, so the staging build shares the staging web origin and production shares https://app.ujimora.com. iOS shares include the URL field. Cancelling causes no error. Share analytics are recorded only for completed campaign shares (Android always reports shared; note this). Known open issue I152: there are no Universal Links / App Links, so shared https links always open the browser.

**Needs:** Web app

**Source:** `apps/mobile/src/components/ShareCampaign.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/app/creator.tsx`

## MOBILE-080 · P1 · Data-rights request submission and response sharing

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Signed-in account; staff able to respond to data-rights requests in admin.

**Steps:**

1. Settings > Your data and privacy requests: choose 'Access to my data'; enter under 10 chars (button disabled); enter details; 'Submit privacy request'.
2. Staff responds in admin; tap 'Refresh privacy requests'.
3. Tap 'Share request and response'; share to Files/Drive/Mail; open the result.
4. Page with 'More requests' / 'Previous requests' after 11+ requests.
5. Tap 'Contact the privacy team' (mailto) and 'Ghana Data Protection Commission'.

**Expect:** Request shows with reference, status and response target date. Response text appears and the share sheet exports the JSON of the request and response (verify it contains only this user's data). Paging works. Mail/DPC links open or show fallback messages. Offline load shows 'Could not load privacy requests. Please retry.'

**Needs:** Admin data-rights queue

**Source:** `apps/mobile/src/components/DataRightsRequests.tsx`, `docs/compliance/DATA_RIGHTS.md`

## MOBILE-081 · P1 · Poor network, API latency and outage sweep across screens

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Network Link Conditioner (iOS) or emulator network profiles (Android): 3G, Edge, 100% loss. A proxy to inject 500 (HTML and JSON), 503 and hangs. A simulated Render cold-start delay.

**Steps:**

1. On 3G: load Home, campaign detail, Wallet, Settings and Subscription. Upload a 3.9 MB KYC image.
2. Mid-upload, switch to 100% loss, then restore. Separately, black-hole the upload so it never completes.
3. Inject 500s (HTML and JSON bodies) on /wallets, /profile, /notifications and /campaigns/:id/comments.
4. Post a comment and toggle a Settings switch while requests fail.
5. Simulate a 45 s API cold start on first launch.
6. Open Explore while the API is failing.

**Expect:** Every screen shows a readable error with a retry (Try again / Retry / Refresh or pull-to-refresh) and never an endless spinner that blocks navigation. Ordinary requests give up after 30 s ('Ujimora took too long to respond. Check your connection and try again.'); uploads give up after 120 s. Offline gives 'Could not reach Ujimora. Check your connection and try again.' HTML 5xx pages give 'Ujimora is temporarily unavailable. Please try again in a minute.' JSON errors show the server's message. No raw 'Network request failed' or JSON parse text appears; log any as a defect. A 45 s cold start fails the first load after 30 s with a retry that then works. Failed Settings toggles revert and show the error banner. A failed comment alerts 'Could not post'. A failed or timed-out upload shows its error, re-enables Continue and discards the local picker copy, leaving nothing half-applied. Explore: log a defect if failures show 'No campaigns found' instead of an error.

**Needs:** Proxy/network shaping tools

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/app/(tabs)/explore.tsx`

## MOBILE-N002 · P1 · Update gate fails open; app-config validation; OTA disabled in release artifacts

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Release builds, a proxy, staging API deploy access, and the unzipped IPA and universal APK from MOBILE-001/002.

**Steps:**

1. Set MIN_APP_VERSION_ANDROID=9.0.0. Cold-launch Android in airplane mode, use the app offline, then go online and resume.
2. Make the proxy return a 503 HTML page, then malformed JSON, for /api/v1/app/config, and cold-launch.
3. Ops: set MIN_APP_VERSION_IOS=abc (then 1.2.0-beta) and deploy. Set APP_STORE_URL_ANDROID=http://play.google.com/... and deploy.
4. Check Expo.plist in the IPA for EXUpdatesEnabled, and the Android manifest for the expo.modules.updates.ENABLED meta-data.

**Expect:** A failed or unreadable policy never locks users out. An offline launch and a 503 or malformed response leave the app usable with no gate. Because a failed check is retried on the next resume, the gate appears once the app is back online and resumed. The API refuses to boot with a clear error: 'MIN_APP_VERSION_IOS must be a numeric app version such as 1.2.0', or 'APP_STORE_URL_ANDROID must be an https:// store URL'. OTA is off in both artifacts (EXUpdatesEnabled=false, expo.modules.updates.ENABLED=false, app.json updates.enabled:false), so payment flows cannot change without store review.

**Needs:** Proxy tool, staging deploy

**Source:** `apps/mobile/src/lib/appUpdate.ts`, `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/mobile/app.json`

## MOBILE-N004 · P1 · Biometric session: 60-second background grace, transient interruptions and hand-off allowance

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Physical iOS and Android devices with biometric unlock enabled. Some unsaved text typed on KYC step 1.

**Steps:**

1. Pull down the notification shade / Control Center, glance at the app switcher and return without leaving the app.
2. Press Home, wait about 30 s and return.
3. Press Home, wait about 70 s and return.
4. Unlock, return to KYC, tap 'Choose file', stay in the picker about 3 minutes, then pick a file.
5. Android: open the notification bell sheet and a date picker (in-app modals), then close them.
6. Tap 'Unlock with biometrics' on a locked app and press Home while the OS prompt is showing, then return.

**Expect:** While the app is interrupted it shows the 'Ujimora is locked' cover with disabled buttons. It returns to the same screen with the typed text intact and no unlock after the shade, Control Center, the app switcher and the 30 s background. After about 70 s, unlock is required; after unlock the screens remount and unsaved KYC text is lost (expected). The picker hand-off (10-minute allowance) returns without a lock and uploads the file. On Android, in-app modals show the lock-style cover behind the modal, and closing the modal restores the screen without unlock. This is a known side effect from the owner note. A background during the unlock prompt cancels that attempt and the app stays locked. The policy needs owner sign-off (I092).

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## MOBILE-N005 · P1 · Biometric unlock expiry is explained and renewable

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** An account with biometric unlock enabled whose saved sign-in is past its 7-day refresh lifetime. Either wait 7 days, or revoke it from the web (change password / enable MFA elsewhere).

**Steps:**

1. Open Settings and read the biometric section.
2. Lock the app (Lock now or a background over 60 s) and tap 'Unlock with biometrics'.
3. Tap 'Unlock with biometrics' again.
4. Tap 'Sign in with password instead', sign in, and turn biometric unlock back on.

**Expect:** Settings says: 'Your account locks when you leave the app for more than a minute… Biometric unlock lasts 7 days after you turn it on or last sign in with your password; after that, sign in with your password to renew it.' The expired unlock shows 'Biometric unlock has expired. It lasts 7 days after you turn it on or last sign in with your password. Sign in with your password, then turn it on again in Settings.' The vault is cleared, so the second attempt shows an error without an OS biometric prompt. Password sign-in works. Re-enabling starts a new 7-day period, and unlock works again.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/session.ts`, `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/unlockError.ts`, `apps/mobile/src/components/BiometricSettings.tsx`, `apps/mobile/src/components/BiometricLock.tsx`

## MOBILE-N006 · P1 · Sign-in gates return to the requested screen; unsafe returnTo values are ignored

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** Signed-out app. A test account (also one with MFA) that owns a donation.

**Steps:**

1. Open the Wallet tab and tap 'Sign In' on 'Sign in to continue'. Sign in.
2. Sign out. Open ujimora://donations/refund/<ownDonationId> ('Sign in to view your refund request.'), sign in with the MFA account and complete the code.
3. Sign out. Open My Donations, tap Sign In, then 'Create one', and register.
4. Sign out. Open ujimora://login?returnTo=%2F%2Fevil.example, ujimora://login?returnTo=https%3A%2F%2Fevil.example, ujimora://login?returnTo=%2Flogin and a returnTo longer than 512 characters, and sign in each time.
5. After each successful return, press back / swipe back.

**Expect:** After sign-in or registration, the app returns to the exact gated screen with its query: Wallet, the same Refund Request (donationId kept) and My Donations. It does not go to Home. Back does not reopen the sign-in screens, because they are dismissed. Protocol-relative, external, auth-screen and over-long returnTo values are dropped, and those sign-ins land on Home. There is no navigation outside the app.

**Needs:** None

**Source:** `apps/mobile/src/components/SignInRequired.tsx`, `apps/mobile/src/navigation/returnTo.ts`, `apps/mobile/app/(auth)/login.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/navigation/resolvePath.ts`

## MOBILE-N007 · P1 · Campaign owner posts, pins and deletes updates on mobile

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** The owner of an active campaign, signed in. A supporter account. OpenAI screening configured and staff available for publication reviews.

**Steps:**

1. As the owner, open the campaign. Under Updates, tap 'Post an update'.
2. Check the 'Update type' options. Enter a 2-character title, then a valid title and body (the body stops at 5,000 characters). Tick 'Pin this update to the top'.
3. Post once without the automated-review consent and once with 'Use OpenAI to check this public text for safety (optional)' ticked.
4. On a posted update, tap Pin/Unpin, then Delete and Cancel, then Delete and Delete.
5. As the supporter, open the same campaign. Check the web page too.

**Expect:** Types are General update, Milestone, Thank you and Urgent. 'Post update' stays disabled for titles under 3 characters or an empty body. A held post keeps the dialog open with the API message inline, e.g. 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' A published post closes the dialog, shows 'Update posted.' and refreshes the list, with the 'Pinned' badge when pinned. Pin/Unpin toggles the badge. Delete asks 'Delete update?' / 'This removes the update for everyone.' and removes it only after 'Delete'. Supporters see no owner tools, but still have Report on updates. The web shows the same updates.

**Needs:** OpenAI moderation, admin publication reviews

**Source:** `apps/mobile/src/components/CampaignUpdatesList.tsx`, `apps/mobile/src/components/CampaignUpdateComposer.tsx`, `apps/mobile/src/lib/campaignUpdates.ts`, `apps/mobile/app/campaign/[id].tsx`

## MOBILE-N010 · P1 · Money shows two decimals in the record's currency across native screens

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** A GHS campaign with raised 100.5 and goal 1000; donations of 30.3 and 100.5; a refund request; an organization with totals; an active live session with donations. A profile with donations and raised amounts (and a second currency if multi-currency data exists).

**Steps:**

1. Check campaign detail (raised, 'raised of', 'Still needed:', Recent donations), CampaignCard, My Donations, Refund Request, My Refunds, the organization 'Raised' stat, the live viewer total and the studio stats.
2. Open the Profile tab stats tiles.
3. Open the OBS overlay for the live session.

**Expect:** Amounts use formatMoney with exactly two decimals and the record's currency, e.g. 'GH₵100.50' and 'GH₵30.30', never '100.5', long float tails or a hard-coded 'GH₵ ' for other currencies. Profile tiles show Campaigns (campaignsCreated), Donated and Raised per currency in compact form (e.g. 'GH₵ 1.2K · US$ 30'), never added together across currencies. The OBS overlay shows two decimals (e.g. 'GH₵ 100.50'). Home and Explore list cards keep their compact GHS K/M format; log a defect if a non-GHS campaign shows GH₵ there.

**Needs:** Seeded data

**Source:** `apps/mobile/src/lib/money.ts`, `apps/mobile/src/lib/profileStats.ts`, `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/components/CampaignCard.tsx`, `apps/mobile/app/my-donations.tsx`, `apps/mobile/app/my-refunds.tsx`, `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/api/src/infrastructure/adapters/inbound/http/views/overlayPage.ts`

## MOBILE-N013 · P1 · Account deletion is refused while balances or payouts are outstanding; open campaigns are warned

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Accounts: one with a GHS 10 wallet balance; one with a payout still processing; one with one open campaign and no balances. A proxy to add a balance between the preview and the delete (optional).

**Steps:**

1. On each account: Settings > Danger Zone > 'Delete Account'. Read the section.
2. On the open-campaign account, enter the password and delete.
3. Optional: open the section on a clean account, credit its wallet from another channel, then enter the password and delete.

**Expect:** Wallet balance: a red message reads 'Your account can’t be closed yet. First withdraw or resolve: GHS 10.00 in your Ujimora wallet. If you can’t, contact support@ujimora.com and we’ll help you close your account.' There is no password field and 'Delete my account' is disabled. Payout processing: the same message with '1 payout still being processed'. Open campaign: the warning 'Closing your account ends your open campaign. It stops accepting donations, and anything awaiting review is withdrawn.' is shown and deletion is allowed; afterwards the campaign no longer accepts donations. A balance that appears after the preview gets a 409 with the current reasons, and the section refreshes to the blocked state. If the closure-check preview cannot load, the API still enforces the rules on delete.

**Needs:** API closure check

**Source:** `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/src/lib/accountClosure.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`

## MOBILE-N014 · P1 · Sign-out revokes the session on the server and clears unsent drafts

*Surfaces:* android, api, ios  ·  *Type:* security/permission

**Before:** A proxy with SSL interception on the device. A signed-in account.

**Steps:**

1. Sign in and note the refreshToken in the /auth/login response.
2. Start a campaign and type a title and story, but do not submit.
3. Profile > Sign out, and watch the traffic.
4. Replay POST /api/v1/auth/refresh with the captured refreshToken.
5. Sign in again and open Start a campaign.
6. Sign out with airplane mode on.

**Expect:** Sign-out sends POST /api/v1/auth/logout {refreshToken} and gets 200 'Signed out'. Replaying refresh with the old token returns 401 'Invalid or expired refresh token'. After signing in again there is no 'We restored your unsent draft' notice, because drafts are cleared on sign-out. Offline sign-out is still immediate and local; the server call is best-effort and is not retried. Known open issue I031: refresh-token rotation and reuse detection are not implemented.

**Needs:** Proxy tool

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/publicationDrafts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts`

## MOBILE-N016 · P1 · Account agreement: server requires a newer version than the build ships

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A staging API built with a newer LEGAL_ACCEPTANCE_VERSION (packages/types) than the installed app build. An account that accepted the older version.

**Steps:**

1. Sign in and read the banner.
2. Tap 'Review agreement'.
3. Tap 'Review on the website' and accept on the web.
4. Back in the app, tap 'I have accepted it, check again'.
5. Before accepting, try to post a comment. Also background the app for over a minute and resume.

**Expect:** The banner reads 'An updated account agreement is available. Update Ujimora to review it before publishing or uploading content.' The agreement screen shows 'An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.' with 'Review on the website' (opens https://app.ujimora.com/account-agreement) and 'I have accepted it, check again'. It has no checkboxes, so the app never accepts terms it has not shown. Publishing gets a 428, which makes the app re-read the status. After web acceptance, 'check again' (or a foreground at least 60 s later) shows 'Your agreement has been saved.' and the banner disappears. Owner note: raise MIN_APP_VERSION_* with any LEGAL_ACCEPTANCE_VERSION bump.

**Needs:** Staging API build with bumped legal version

**Source:** `apps/mobile/src/components/AccountAgreementNotice.tsx`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/src/lib/agreementStatus.ts`, `apps/mobile/src/lib/agreementEvents.ts`, `apps/mobile/src/context/AuthContext.tsx`

## MOBILE-N017 · P1 · Explore uses server search, paging and effective status

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** More than 20 public campaigns, including at least one past its end date (expired), one funded, and one whose title matches a word not in the newest 20.

**Steps:**

1. Open Explore. Type the rare word in 'Search campaigns...' and wait about 300 ms.
2. Clear the search. Tap 'Load more' until it disappears.
3. Filter by status: Active, Funded, Expired. Sort: Newest, Top Funded, Ending Soon.
4. Combine a category with Expired.
5. Make the API fail and pull a new search.

**Expect:** Search runs on the server and finds matching campaigns beyond the first page. The count shows the server total ('N campaigns'). 'Load more' appends 20 at a time with no duplicates and disappears on the last page. A campaign past its end date appears only under Expired, never under Active or Funded. 'Ending Soon' lists only open campaigns, in endDate order, unless Expired is chosen. On failure the requirement is a readable error with a retry; the current code shows '0 campaigns' and 'No campaigns found' (the error is not rendered), so log that as a defect.

**Needs:** Seeded campaigns

**Source:** `apps/mobile/app/(tabs)/explore.tsx`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/mobile/src/lib/exploreSearch.ts`

## MOBILE-015 · P2 · https web links and in-app notification 'View details' routing

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** App installed. An account with in-app notifications that carry paths, e.g. donation received, a campaign review decision (/campaigns/<id> or /my-campaigns), a KYC decision (/kyc), a refund (/donations/refund/<id>), a subscription notice (/subscription) and an organization invitation (/organization-team).

**Steps:**

1. Tap an https://app.ujimora.com/c/<slug> link in WhatsApp/Messages.
2. In the app, tap the bell, open a notification and tap 'View details'.
3. Repeat for each notification path listed in the preconditions.

**Expect:** https links open in the browser. 'View details' opens the matching native screen through resolveNativePath: /campaigns/<id> → the campaign, /my-campaigns → My Campaigns, /kyc → Identity verification, /donations/refund/<id> → Refund Request, /subscription → Subscription. Unknown paths go to 'Lost in the journey?', never a blank screen. /organization-team has no native route, so organization-invitation notices land on 'Lost in the journey?'. Log that as a defect; it should open Invitations. Known open issue I152: Universal Links / App Links are not configured, so https links always open the browser. That needs an owner decision and signing data.

**Needs:** Staging notifications data

**Source:** `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app.json`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`

## MOBILE-023 · P2 · Organization registration and website-request banner withdrawal

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** New email; release build.

**Steps:**

1. Register choosing 'Organization'; leave Website empty; tick 'Does your organization need a website?'; pick Organization type; submit.
2. Observe the banner about Neurodyne Corp Ltd on all screens; tap neurodyne.dev and info@neurodyne.dev.
3. Tap 'Withdraw website request', then 'Dismiss'.
4. Relaunch the app.

**Expect:** Org name is required; type picker works. Banner appears only for organization accounts that requested a website, links open browser/mail (error text if no mail app). Withdraw shows 'Your website-contact request has been withdrawn.' and the banner is gone after relaunch. Profile/verification labels do not claim 'verified' before institutional verification.

**Needs:** None

**Source:** `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/src/components/WebsiteRequestNotice.tsx`

## MOBILE-053 · P2 · Publication consent and publication review status

*Surfaces:* admin, android, api, ios  ·  *Type:* compliance

**Before:** Verified member; staff in admin to decide reviews.

**Steps:**

1. Create a campaign without ticking 'Use OpenAI to check this public text for safety (optional)'; then another with it ticked.
2. Post a comment and a campaign update.
3. Settings > Publication reviews: page through; 'Refresh publication reviews' after staff decisions.

**Expect:** Without consent, content goes to staff review; with consent, automated screening runs. Held content is not publicly visible until approved. Publication reviews list shows each item's decision after refresh with working Previous/Next paging.

**Needs:** OpenAI moderation, admin moderation

**Source:** `apps/mobile/src/components/PublicationConsent.tsx`, `apps/mobile/src/components/PublicationReviews.tsx`, `apps/mobile/app/campaign/create.tsx`

## MOBILE-071 · P2 · Dark mode, skins and status bar legibility

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Release build.

**Steps:**

1. Settings > Appearance: Light, Dark, System; toggle OS dark mode while app is open on System.
2. Settings > Design finish: Neumorphic, Clay, Glass, Minimal in both light and dark.
3. Visit Home, login, campaign detail, Donate, Wallet, Subscription, lock screen, dialogs, date picker, not-found.
4. Kill and relaunch.

**Expect:** All text meets contrast; no invisible text on buttons (hardcoded colors such as #221B0E/#F5F2EA remain legible); status bar icons readable on each screen (light on Home and dark theme, dark otherwise). Preference and skin persist across relaunch; System follows the OS live.

**Needs:** None

**Source:** `apps/mobile/src/context/ColorModeContext.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/src/theme.ts`

## MOBILE-075 · P2 · Reduce Motion / remove animations

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** iOS Reduce Motion on; Android Remove animations on.

**Steps:**

1. Cold launch (custom splash), navigate screens, trigger a successful donation celebration (Android) and skeleton loaders.

**Expect:** Celebration, skeleton pulses and FadeInUp honor reduce motion. The custom splash animation should be shortened/static; source shows no reduce-motion check in SplashScreen - log if it still animates heavily. No functionality depends on animation completion.

**Needs:** None

**Source:** `apps/mobile/src/components/SplashScreen.tsx`, `apps/mobile/src/components/DonationCelebration.tsx`, `apps/mobile/src/components/Loading.tsx`, `apps/mobile/src/components/anim/FadeInUp.tsx`

## MOBILE-082 · P2 · Background/resume refresh of live data

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** A signed-in account with a campaign detail page, the Wallet, notifications and a pending Android payment open. Test with biometric unlock off, and once with it on.

**Steps:**

1. Background the app. From another device, donate to the campaign, trigger a notification and complete the pending payment. Also credit this account's wallet (e.g. a web top-up).
2. Resume after 1 minute and after 30 minutes.
3. Check campaign totals, the bell badge, PaymentStatus, Wallet, Dashboard, the creator page and live studio stats.

**Expect:** On resume, campaign detail, notifications (bell count), PaymentStatus, the creator page and live stats refresh by themselves. The Wallet tab reloads balance and activity when it regains focus or the app returns to the foreground on it, with no navigation needed, and it supports pull-to-refresh. Dashboard may still need navigation; log stale data if it persists after returning to it. No crash from timers after a long background. With biometric unlock on, a background over 60 s needs unlock first, and the refreshes run after unlock.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/context/NotificationContext.tsx`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/mobile/src/hooks/useWallet.ts`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/app/dashboard.tsx`

## MOBILE-084 · P2 · In-app notification inbox

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** An account with several unread in-app notifications (turn on activity alerts in Settings first), and a second account seeded with more than 50 unread notifications (e.g. 60).

**Steps:**

1. Check the bell badge count.
2. Tap the bell. Check the list, timestamps and 'New' markers. Tap 'Mark as read', once while offline.
3. Tap 'View details' on a notification that has a path.
4. Close with 'Close notifications', a swipe down (iOS pageSheet) or Android back.
5. On the 60-unread account, check the badge and scroll to the end of the list.
6. Sign out and confirm the bell strip disappears.

**Expect:** The badge updates after Mark as read. Failures show an error and keep the state consistent. View details routes correctly. The empty state reads 'You’re all caught up'. The bell never shows when signed out. The list refreshes every 30 s while active and on resume. Requirement: the badge equals the total unread count, showing 99+ above 99. Known open issue I103: /notifications now returns only the newest 50 (up to 100, with ?before= for older), and the app counts unread only among the items it loaded. The 60-unread account therefore shows at most 50 on the badge, and older notifications cannot be reached in the sheet. The mobile badge does not use the unread-count endpoint yet.

**Needs:** None

**Source:** `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/context/NotificationContext.tsx`

## MOBILE-085 · P2 · Settings preferences: activity alerts, newsletter, privacy toggles and public profile

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** A signed-in account with an unverified email, with donations on the leaderboard. A second account to view this user's profile. Staff access to publication reviews.

**Steps:**

1. Activity alerts and emails: turn on a category, tap 'Send verification link', verify the email, then tap 'Check verification status'.
2. Marketing emails and newsletter: opt in, tap 'Resend newsletter confirmation', confirm through the email, then opt out.
3. Turn 'Show on Leaderboard' off and open Leaderboard (all periods).
4. Turn 'Anonymous Donations' on. Open the Android Donate form, donate, and check the campaign's recent donations.
5. Look for a Language setting under Account.
6. Turn 'Public profile' off, then open this user's profile from the second account (for example through a comment author link).
7. Turn 'Public profile' on without ticking 'Use OpenAI to check this public text for safety (optional)'. Then tick it and try again, or have staff approve the review, and retry.

**Expect:** Alerts and emails are off by default and need a verified email. Each confirmation email arrives once (the newsletter uses double opt-in). With 'Show on Leaderboard' off, the user is hidden from the leaderboard. With 'Anonymous Donations' on, the Android donate form pre-ticks 'Donate anonymously' and clears the pre-filled account name, and the donation shows 'Anonymous'. There is no Language picker; it was removed and the app is English-only. Account shows only 'Currency GHS'. With the public profile off, the second account sees 'This profile is not available.' with report and block still offered. Turning it on is a publication. Without approval the toggle reverts and the error banner shows 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' With consent that passes screening, or after approval, it stays on. Any failed save reverts and shows the error banner.

**Needs:** Email provider

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/src/lib/privacySettings.ts`, `apps/mobile/src/lib/donationDefaults.ts`, `apps/mobile/src/components/ActivityAlertSettings.tsx`, `apps/mobile/src/components/NewsletterSettings.tsx`, `apps/mobile/app/leaderboard.tsx`

## MOBILE-N008 · P2 · Comment authors link to member profiles; unavailable profiles keep report/block

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** A campaign with comments from: a public member, a member whose Public profile is off, and a member who has blocked the viewer. The viewer is signed in.

**Steps:**

1. Tap a comment author's name, then their avatar (with VoiceOver/TalkBack on once).
2. Open the author whose profile is hidden, and the author who blocked you.
3. On the 'not available' screen, use Report and Block.

**Expect:** Name and avatar both open /profile/<authorId>; the screen reader announces a link, 'View <name>'s profile'. A public profile renders normally. Hidden or blocked profiles show 'This profile is not available.' and still offer UserSafetyControls, so Report and Block work there. Authors without a real 24-hex account id are not linked.

**Needs:** None

**Source:** `apps/mobile/src/components/CampaignComments.tsx`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/src/components/UserSafetyControls.tsx`

## MOBILE-N009 · P2 · Wallet tab pull-to-refresh and refresh-error handling

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** A signed-in account with a GHS wallet and a proxy to fail /wallets.

**Steps:**

1. Open Wallet and pull down.
2. With the proxy failing /wallets, pull down again, then switch tabs and back.
3. Restore the API and pull down.
4. Fresh launch with /wallets failing, then open Wallet and tap 'Try again' after restoring the API.

**Expect:** Pull-to-refresh shows the spinner and reloads balance and activity. A failed reload keeps the last balance on screen and shows "Couldn't refresh your wallet: <message> Pull down to try again." The next successful reload clears the message. If the very first load fails, the app shows "Couldn't load wallet" with the error and a 'Try again' button that recovers. There is never a full-screen skeleton after the first load.

**Needs:** Proxy tool

**Source:** `apps/mobile/src/hooks/useWallet.ts`, `apps/mobile/app/(tabs)/wallet.tsx`

## MOBILE-N011 · P2 · Startup sweep removes stale KYC picker copies

*Surfaces:* android, ios  ·  *Type:* security/permission

**Before:** An inspectable build from the same commit (adb run-as com.ujimora.app, or the Xcode container download). A signed-in member on KYC.

**Steps:**

1. On KYC, pick an ID image from the library and take a selfie with the camera. Force-kill the app as soon as each picker returns, before the upload finishes.
2. List <cache>/ImagePicker and <cache>/DocumentPicker, including nested folders, and one other cache folder.
3. Relaunch the app, then list the folders again.
4. Immediately after relaunch, pick a new file and list the folders again.

**Expect:** Before relaunch, the picker copies (ID image, selfie) are in the cache. After relaunch, every file in ImagePicker and DocumentPicker older than the launch is deleted, including nested ones. Other cache folders are untouched, and the file picked after launch survives until its own upload cleanup. No crash. If a delete fails, one warning is logged ('Temporary file cleanup could not complete; it will retry at the next app start.') and the sweep retries at the next start. The recovery-code sweep still runs.

**Needs:** Inspectable build

**Source:** `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/app/_layout.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`

## MOBILE-N012 · P2 · Legacy /u/<id> creator QR links and site-root referral links resolve natively

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** A member with a public profile (user id known) and a creator page. An affiliate referral code. A printed or old creator QR whose short link pointed at /u/<id>.

**Steps:**

1. Open ujimora://u/<userId> cold and warm.
2. Open ujimora://?ref=<CODE> while signed out.
3. Scan the old creator QR with the phone camera and follow the short link.

**Expect:** ujimora://u/<userId> opens that member's public profile, never 'Lost in the journey?'. ujimora://?ref=<CODE> opens Register with the referral code pre-filled, instead of dropping the code on Home. The old QR short link now redirects on the server to /creators/<handle> in the browser, with no /u/ page.

**Needs:** Short-link service

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/profile/[id].tsx`, `apps/mobile/app/(auth)/register.tsx`

## MOBILE-N015 · P2 · Unsent campaign draft and held profile changes survive app restarts

*Surfaces:* admin, android, api, ios  ·  *Type:* recovery/idempotency

**Before:** A verified member with campaign capacity. Staff for publication reviews. A second account on the same device.

**Steps:**

1. Start a campaign: fill the title, story, beneficiaries, cover, goal and end date. Kill the app, relaunch and open Start.
2. Tap 'Start over'.
3. Refill and submit without automated-review consent so it is held for review. Reopen Start, and after staff approval submit the same version again.
4. Edit profile: pick a new profile photo and tap Save profile so it is held. Leave the screen and reopen Edit profile.
5. Sign in as the second account on the same device and open Start.

**Expect:** After relaunch, the form restores with 'We restored your unsent draft from this device. If it is waiting for safety review, submit this same version again once it is approved.' 'Start over' clears it. The held draft is kept, and resubmitting the unchanged version after approval creates the campaign and clears the draft. Edit profile restores the held photo with 'We restored the changes you last submitted for review. Save them again once they are approved.' Drafts belong to one account and are never shown to another, and drafts older than 30 days are discarded. Known open issue I073: server-side auto-publish of approved versions is not built.

**Needs:** Publication review workflow

**Source:** `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/publicationDrafts.ts`

## MOBILE-N018 · P2 · Donor disclosures and defaults: split notice, anonymous-by-default, donation terms line

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED on, and a campaign with an active split (e.g. Ama 60%, Kofi 40%). A non-public (pending) campaign with a split. A signed-in donor whose 'Anonymous Donations' setting is on.

**Steps:**

1. Open the split campaign's detail on iOS and Android, then the Android Donate form.
2. As another account, request /campaigns/<pendingId>/split directly.
3. As the anonymous-by-default donor, open Android Donate. Check 'Donate anonymously' and the Name field, then untick it and donate. Repeat without unticking.
4. Tap the Terms of Use, Contributor Terms and Privacy Notice links under the donate form.

**Expect:** Campaign detail (both platforms) and the Android Donate form show 'This campaign's proceeds are shared: Ama 60%, Kofi 40%.' Campaigns without a split show nothing. The split of a non-public campaign returns 404 to anyone other than the owner or an admin. The anonymous-by-default donor sees 'Donate anonymously' pre-ticked and the pre-filled account name cleared. Unticking is respected, and each donation shows publicly as chosen. The terms line links open the in-app policy pages. Known open issue I086: the line is informational; no consent is recorded.

**Needs:** Split proceeds enabled

**Source:** `apps/mobile/src/components/SplitDisclosure.tsx`, `apps/mobile/src/lib/splitDisclosure.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/donationDefaults.ts`, `apps/mobile/app/campaign/[id].tsx`

## MOBILE-N019 · P2 · Staff decision notices and organization invitations in the native inbox

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** A member with a campaign pending review, a KYC submission, and a comment that another user reported. An organization owner on the web. The member's email is verified (and one run unverified).

**Steps:**

1. Staff approves the campaign, and in a second run rejects or blocks it. Staff approves, rejects (with a reason) or requests information on the KYC. Staff reviews the safety report with hide_comment.
2. The member opens the bell, reads each notice and taps 'View details'.
3. The organization owner invites the member's email on the web. The member opens the bell, then Profile > Invitations.
4. Tap 'Accept invitation', once with an unverified email and once verified.
5. As an organization owner or admin, open Invitations.

**Expect:** Each decision creates one inbox notice, never duplicated on retries: 'Your campaign is live' (opens the campaign); 'Your campaign was not approved' / 'Your campaign has been blocked' / 'Your campaign is back in review' (open My Campaigns); 'Your identity verification is approved' / 'Your identity verification was not approved' (with 'Reason: …') / 'More information needed for your verification' (open Identity verification); 'We reviewed your report' for the reporter; 'Your comment was removed' for the author. The invitee gets 'Organization invitation'. Invitations shows 'Organization teams' with the organization, 'Invited as <role>. Invitations expire after seven days.' and 'Accept invitation'. Accepting shows 'Accepted' / 'You joined the organization team.'; with an unverified email it shows 'Could not accept' with the API reason. Owners and admins see 'Manage your organization team on the website'. The organization-invitation notice's View details (/organization-team) has no native route and lands on 'Lost in the journey?'; log that as a defect. Known open issue I181: no email is sent for organization invitations.

**Needs:** Admin console, web organization team

**Source:** `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/components/OrganizationInvitations.tsx`, `apps/mobile/src/lib/organizationInvitations.ts`, `apps/mobile/app/invitations.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoStaffDecisionNotices.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`

## MOBILE-N020 · P2 · Email verification prompt on the native Dashboard

*Surfaces:* android, api, email, ios  ·  *Type:* functional

**Before:** A newly registered account with an unverified email and email delivery configured. A verified account. An environment without email delivery.

**Steps:**

1. Right after registering, check the mailbox.
2. Open Profile > Dashboard on the unverified account and tap 'Send verification link'. Tap it again straight away.
3. Verify through the email and reopen Dashboard.
4. Open Dashboard on the verified account and in the environment without email delivery.

**Expect:** A verification email is queued at sign-up; signup never fails if email fails. Dashboard shows 'Verify your email address. Automatic payouts and organization invitations need a verified email.' with 'Send verification link'. After a tap: 'Check your email for a verification link. Allow a minute before requesting another.' Errors show inline. After verifying, the notice disappears. It is also hidden for verified accounts and when email delivery is not configured.

**Needs:** Email provider

**Source:** `apps/mobile/src/components/EmailVerificationNotice.tsx`, `apps/mobile/src/lib/emailVerification.ts`, `apps/mobile/app/dashboard.tsx`

## MOBILE-N021 · P2 · Payout account removal confirmation and affiliate payout destination on native

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** A member with one name-matched and one unmatched saved payout account. An enrolled affiliate with an available balance and no payout destination.

**Steps:**

1. Profile > Payout accounts. Check the label on the unmatched account. Tap 'Remove saved account', then Cancel and dismiss.
2. Tap 'Remove saved account' again and confirm 'Remove account'.
3. Profile > Affiliate: check 'Request payout' and its hint. Open the payout destination list.
4. Choose the matched account and tap 'Use this account', then 'Request payout'.
5. Read the enroll/program text on a non-enrolled account.

**Expect:** The unmatched account reads 'Name not matched: creator withdrawals need a matched account'. Removal asks 'Remove saved account?' with '<name> ending <last4> will be removed from your saved payout accounts…'. Cancel or dismiss keeps the account; 'Remove account' deletes it. The affiliate cannot request a payout: the button is disabled with 'Choose a payout destination before requesting a payout.' Only name-matched accounts can be chosen, and unmatched ones are listed as '… — name not matched, cannot receive payouts'. After saving, the card shows 'Payouts go to <name> · <bank> · ••<last4>' with 'Change payout destination', and Request payout works. The program text says the commission is one-time when a referral buys their first paid plan on the Ujimora website. Known open issue I061: App Store / Google Play purchases earn no commission (owner decision).

**Needs:** Paystack recipient verification (test)

**Source:** `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/mobile/src/lib/confirmDestructive.ts`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/src/components/AffiliatePayoutDestination.tsx`, `apps/mobile/src/lib/affiliate.ts`
