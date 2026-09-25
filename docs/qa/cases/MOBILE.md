# Mobile platform (iOS & Android) (85 cases)

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
3. Confirm targetSdkVersion, allowBackup, fullBackupContent, dataExtractionRules, firebase_messaging_auto_init_enabled and firebase_analytics_collection_enabled meta-data.
4. Confirm expo.modules.location.services.LocationTaskService is absent and the WebRTC mediaProjection service declares foregroundServiceType mediaProjection.
5. Run zipalign -v -c -P 16 4 app.apk and python scripts/compliance/inspect-android-native.py app.apk --readelf <llvm-readelf>.

**Expect:** No POST_NOTIFICATIONS, READ_MEDIA_IMAGES/VIDEO/AUDIO, READ_EXTERNAL_STORAGE, ACCESS_BACKGROUND_LOCATION, SYSTEM_ALERT_WINDOW or FOREGROUND_SERVICE_LOCATION. CAMERA, RECORD_AUDIO, ACCESS_FINE/COARSE_LOCATION, FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PROJECTION present; any other transitive permission (e.g. BLUETOOTH_CONNECT, MODIFY_AUDIO_SETTINGS, legacy WRITE_EXTERNAL_STORAGE maxSdk) is listed and reconciled with Play Data safety and NATIVE_PERMISSIONS.md. allowBackup=false with the ujimora backup/extraction rules; both Firebase auto-init flags false; targetSdk 36; ujimora scheme intent filter present. ZIP 16 KB alignment passes; all 64-bit libs pass LOAD alignment; RELRO failures match only the known upstream set.

**Needs:** EAS build, Google Play Console internal track

**Source:** `apps/mobile/app.json`, `apps/mobile/plugins/withPrivateBackupRules.js`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `apps/mobile/plugins/withForegroundLocationOnly.js`, `apps/mobile/plugins/withAndroidPageAlignment.js`, `docs/compliance/NATIVE_PERMISSIONS.md`, `scripts/compliance/inspect-android-native.py`

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

**Before:** Signed-in account; fresh install (permissions never asked). Screens: KYC (Front of your ID, Selfie), Start a campaign step 2 'Campaign cover', Edit profile 'Cover image'/'Profile photo' camera icons.

**Steps:**

1. On KYC 'Front of your ID' tap Camera; read the system prompt text; Allow; take a photo; confirm 'Uploaded'.
2. Reset permissions (iOS Settings > Ujimora > Camera off; Android App info > Permissions > Camera Deny); tap Camera again.
3. Android: deny twice to reach 'Don't ask again'; tap Camera again.
4. Tap 'Choose file' after denial.
5. Repeat camera capture on campaign cover and profile photo (crop UI on cover/profile).

**Expect:** Prompt shows the app.json camera purpose string. Grant: photo uploads (under 4 MB) and shows Uploaded/preview. Deny: message 'Camera permission is needed to take a photo. You can choose a file instead.' with no crash; file/library path still works. Permanently denied: same message without a prompt (note: no 'Open Settings' shortcut exists - record UX gap). Crop aspect 16:9 for cover and 1:1 for profile.

**Needs:** Cloudinary / private KYC storage for uploads

**Source:** `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/app/profile/edit.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app.json`

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

**Before:** Biometric unlock enabled; wallet with balance and a KYC status visible. Second run with biometric disabled.

**Steps:**

1. Open Wallet; swipe up to the app switcher (iOS) / Recents (Android); inspect the snapshot.
2. Send app to background for 5 s; return; observe lock screen; tap 'Unlock with biometrics' and fail twice, then succeed.
3. Lock again; tap 'Sign in with password instead'.
4. With VoiceOver/TalkBack on, check nothing behind the lock is focusable.
5. Repeat app-switcher check with biometrics disabled.

**Expect:** With biometrics on, the switcher/Recents snapshot shows the lock screen, not balances; returning shows 'Ujimora is locked'; unlock restores the session (server refresh). Password fallback signs out and clears the biometric vault. Screen reader cannot reach hidden content (accessibilityViewIsModal). With biometrics off, snapshot shows content - confirm this is acceptable (no FLAG_SECURE/privacy cover) and record the decision.

**Needs:** Physical devices

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/src/lib/session.ts`

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

**Before:** Demo account from APP_REVIEW_NOTES (ordinary member, KYC approved, MFA and biometrics off) on the production API; at least one active campaign with donations, comments, updates, a creator page and an organization; subscription products live in sandbox.

**Steps:**

1. Sign in with the demo credentials on a clean install.
2. Follow the reviewer notes literally: browse campaigns/organizations/creators/live, legal pages signed out and in, Donate on iOS (Safari handoff) and Android (Paystack), Profile > Subscription > Restore purchases and Manage subscription, Report and Block on each UGC surface, Settings > Delete Account (cancel at the alert), Start a campaign (verified user).
3. Verify each path the notes describe exists at the described location.
4. Check that no placeholder text '<...>' remains in the store notes.

**Expect:** Every claim in APP_REVIEW_NOTES is reproducible. Known discrepancies to fix in the notes before submission: Subscription/Restore is under Profile > Subscription (not Settings); host audio/camera is turned off when the host backgrounds unless screen-sharing (notes say audio continues). Demo account is not staff and never hits an MFA/biometric gate.

**Needs:** Production/staging API, App Store Connect + Play Console review accounts

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/LiveVideo.tsx`

## MOBILE-038 · P0 · iOS donation handoff: no in-app payment anywhere

*Surfaces:* ios, web  ·  *Type:* compliance

**Before:** iPhone and iPad release builds; active campaign with slug; campaign closed/funded; active live session; signed in and signed out.

**Steps:**

1. Campaign detail > 'Donate Now'.
2. Verify screen 'Support this campaign' has only text and 'Continue in browser' (no amount, email, wallet, crypto, tip, coupon fields).
3. Tap 'Continue in browser'; confirm Safari (not an in-app browser) opens /c/<slug>/donate.
4. Complete a Paystack test payment in Safari; switch back to the app.
5. From a live viewer page tap 'Support this campaign' and inspect the Safari URL for liveSessionId.
6. Repeat for a closed campaign and a campaign with no slug.
7. Double-tap 'Continue in browser'.

**Expect:** No payment UI is rendered inside the iOS app (App Review 3.2.1(vi)/3.2.2). Safari opens the correct campaign with liveSessionId when valid. Returning shows no success claim ('Returning to the app does not confirm payment...'); campaign totals update after webhook on refocus. Closed/no-slug campaigns show 'not accepting donations right now' with no button. Double tap opens Safari once or harmlessly twice without app error.

**Needs:** Web app, Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/live/[sessionId].tsx`

## MOBILE-039 · P0 · iOS wallet top-up handoff and balance refresh after return

*Surfaces:* api, ios, web  ·  *Type:* compliance

**Before:** iOS signed-in account with a GHS wallet; web account same credentials; Paystack test keys.

**Steps:**

1. Profile > Wallet; confirm 'Fund your wallet' card with 'Continue in browser' only.
2. Tap it; Safari opens https://app.ujimora.com/wallet; sign in on web; top up GHS 50 with a test card.
3. Return to the app Wallet tab without killing it; wait 30 s; switch tabs and back.
4. Kill and relaunch; open Wallet.

**Expect:** No in-app top-up inputs on iOS. Web top-up credits GHS 50 exactly once; transaction appears in Recent Activity as DEPOSIT with correct sign and amount. Balance should refresh on return; source fetches wallet only on mount, so if the balance is stale until relaunch log a P1 defect. Total Balance formatting shows GHS with 2 decimals.

**Needs:** Web app, Paystack test keys

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/lib/fundraising.ts`

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

**Before:** Disposable account with a donation history, biometric unlock enabled, and optionally a sandbox subscription.

**Steps:**

1. Profile > Settings > Danger Zone > 'Delete Account'.
2. Read the alert; tap Cancel; confirm nothing changed.
3. Tap 'Delete Account' > 'Delete' with network off.
4. With network on, tap Delete.
5. Try to sign in again with the same credentials; try biometric unlock.
6. Check admin/closure records.

**Expect:** Alert explains immediate closure, retained financial/safety records and that store subscriptions are not cancelled. Offline shows 'Could not delete account' with a retryable message. Success signs out, returns to login, clears tokens and the biometric vault. Sign-in with the deleted account fails. Server marks account closed with PII erasure queued; donations remain for integrity.

**Needs:** API data-rights/closure jobs

**Source:** `apps/mobile/app/settings.tsx`, `docs/compliance/DATA_RIGHTS.md`

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

**Before:** Android release build pointed at staging with Paystack TEST keys and webhook delivery; active GHS campaign; signed-in donor with verified email; admin access.

**Steps:**

1. Campaign detail > Donate Now. Enter Amount 100.50, keep email, Name, Message; tick the 18+ content terms; Tip 5; method 'Card or mobile money · secure checkout'.
2. Verify the button reads 'Donate 105.50 GHS'; tap it.
3. In the browser tab pay with a Paystack test card; close the tab after the web callback page.
4. Observe PaymentStatus until 'Thank you for your support'; tap 'Refresh content review'.
5. Check campaign raised amount/donor count, My Donations, Dashboard, receipt email and admin ledger.
6. Repeat with a mobile-money test number.

**Expect:** Checkout amount at Paystack equals 105.50 GHS. After webhook: status SUCCEEDED, celebration shown (reduced motion respected), campaign raised increases by the donation amount per fee policy (not by the tip), tip recorded separately, fees match the plan rate, My Donations shows GH₵ 100.50 with status. One receipt email. Ledger balanced with no duplicate entries. Message appears publicly only after content review.

**Needs:** Paystack test keys + webhook, email provider

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/my-donations.tsx`

## MOBILE-055 · P0 · Android donation input validation, rounding, coupons and wallet method

*Surfaces:* android, api  ·  *Type:* negative/edge

**Before:** Android signed-in donor with wallet balance GHS 20; valid fee-waiver coupon, expired coupon, over-used coupon; guest session.

**Steps:**

1. Try amounts: empty, 0, -1, 0.001, 10.555, 10.5, 1,000 (comma), pasted '1e3', 99999999; observe button state/label.
2. Tip values: -5, 0.005, 2.50.
3. Signed in: enter valid coupon; read 'Applied — X GHS more reaches this campaign.'; then invalid/expired codes.
4. Signed out: confirm no coupon field and no wallet method.
5. Choose 'Ujimora wallet · existing balance' with amount 50 (> balance) then 10.
6. Leave email empty/invalid with card method.

**Expect:** Button disabled for non-positive or >2-decimal amounts/tips and shows '0' label when invalid; '1e3' should not silently become 1000 (log if it does). Coupon preview matches server fee calculation and invalid coupons disable Donate with the reason. Guests see neither coupon nor wallet. Wallet over-balance returns a clear insufficient-funds error with no debit; 10 succeeds and wallet decreases by exactly 10 (+tip if applicable). Card method requires a valid email.

**Needs:** Coupons configured, Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/coupons.ts`

## MOBILE-056 · P0 · Android donation idempotency: double tap, network drop, kill and resume

*Surfaces:* admin, android, api  ·  *Type:* recovery/idempotency

**Before:** Paystack test keys; proxy able to drop the response of POST /donation-intents; admin view of intents.

**Steps:**

1. Double-tap the Donate button rapidly.
2. Drop the response of POST /donation-intents (request reaches server); tap Donate again with identical inputs.
3. Change the amount and tap Donate.
4. After checkout opens, kill the app; relaunch and reopen the same campaign's Donate screen.
5. Pay in the browser, then return; tap 'Check status' repeatedly; replay the Paystack webhook from the dashboard.

**Expect:** Only one intent per identical input (same Idempotency-Key reused after a lost response); changed input creates a distinct attempt. After relaunch the screen shows the pending PaymentStatus with 'Open secure checkout' (no new form). Repeated status checks and webhook replay produce exactly one donation, one ledger credit and one receipt.

**Needs:** Paystack test keys + webhook replay, proxy tool

**Source:** `apps/mobile/src/lib/payments.ts`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/components/PaymentStatus.tsx`

## MOBILE-059 · P0 · Android wallet top-up amount limits, test-mode banner and single credit

*Surfaces:* admin, android, api  ·  *Type:* functional

**Before:** Android signed-in account with GHS wallet; Paystack test keys (mode test).

**Steps:**

1. Profile > Wallet; confirm 'Test mode: this checkout does not collect live money.'
2. Enter 0, 10000.01, 12.345; then 150; tap 'Fund wallet' twice quickly.
3. Pay in the browser tab; return; wait for 'Wallet funded'.
4. Kill the app during pending state; relaunch Wallet.
5. Replay the webhook; check balance and ledger.

**Expect:** Button disabled outside 0 < amount <= 10000 with 2 decimals. One top-up created. After verification the wallet balance increases by exactly 150.00 and Recent Activity shows one DEPOSIT (+). Pending state recovers after relaunch. Webhook replay does not double-credit. Production build must NOT show the test-mode banner.

**Needs:** Paystack test keys + webhook

**Source:** `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/src/lib/payments.ts`

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

**Before:** Signed release build on Android 14, 15 and 16 devices; live session running as host.

**Steps:**

1. Tap 'Share screen'; deny the system capture prompt.
2. Tap again; accept; choose entire screen and then a single app (Android 14+ app selection).
3. Pull down the shade: verify the ongoing notification; switch to another app for 30 s; speak.
4. Tap 'Stop sharing'; then share again and stop from the system notification / status-bar chip; repeat 3 sessions.
5. Record a short video of Go live > Share screen > prompt > notification > Stop for the Play declaration.

**Expect:** Deny: no capture, no crash, readable error. Accept: viewers see the screen; visible service notification while sharing; enabled mic continues; other apps' audio not captured ('Other apps’ audio is not included'). Stop and system revocation end capture and the notification; repeated sessions work.

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

## MOBILE-005 · P1 · First launch and cold start with no network or API down

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Release build. Ability to enable airplane mode and to block the API host (proxy map-remote to return 503 HTML, and a timeout).

**Steps:**

1. Fresh install; enable airplane mode; launch.
2. On Home tap 'Try again' under 'Could not load campaigns'.
3. Disable airplane mode and tap Try again.
4. Block API host returning a 503 HTML page; go to Sign In, enter valid credentials, tap Sign In.
5. Make the API hang (no response) and open Explore, a campaign and Sign In.
6. Open Profile > All policies while offline.

**Expect:** No crash. Home shows 'Could not load campaigns' with Try again and recovers once online. Legal pages render offline. Login against an HTML 503 shows a readable error (flag if it shows a raw 'JSON Parse error' - unauthenticated requests parse JSON before checking status). Hanging requests eventually surface an error or can be retried; no permanent spinner blocking navigation (note: fetch has no timeout).

**Needs:** Proxy tool

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/src/components/LegalScreen.tsx`

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

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Affiliate account with referral code (e.g. from Profile > Affiliate). Signed-out app.

**Steps:**

1. Open ujimora://register?ref=<CODE> (and https://app.ujimora.com/register?ref=<CODE> via adb/Notes).
2. Check the 'Referral code (optional)' field.
3. Complete registration; in the affiliate account check Referrals.

**Expect:** Field is pre-filled with the code and the referral is attributed. NOTE: resolvePath returns '/(auth)/register' without the query string, so this is expected to FAIL today; log as a defect if the field is empty. Manual entry of the code must still work and validate (invalid code shows an inline error).

**Needs:** Affiliate program enabled

**Source:** `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app/(auth)/register.tsx`

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

**Before:** Account with biometric unlock enabled; app backgrounded (locked).

**Steps:**

1. With the app locked in background, open ujimora://my-donations.
2. Observe the lock screen; tap 'Unlock with biometrics'.
3. Kill the app, open ujimora://settings (cold, locked), unlock.
4. Sign out; open ujimora://settings; tap Sign In and sign in.

**Expect:** Lock screen appears first; no private content or screen title visible behind it (also with VoiceOver/TalkBack). After unlock the app shows a consistent screen with no replayed/stale duplicate navigation and no content flash before lock. Signed-out flow shows the Sign In gate; after sign-in the user lands on Home (note: destination is not preserved - record as P2 UX gap).

**Needs:** Biometric-capable physical device

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/components/BiometricLock.tsx`, `apps/mobile/app/(auth)/login.tsx`

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

1. Tap 'Use my location'; read the prompt; choose Allow Once (iOS) / Only this time (Android).
2. Verify Country, State, City, Street fill in; edit a field manually.
3. Reset and choose Don't Allow; tap again.
4. Android: choose Approximate location; tap again.
5. Turn Location Services off globally; tap again.
6. After the flow, inspect iOS Settings > Privacy > Location Services > Ujimora and Android App info > Location.

**Expect:** Prompt shows 'Use your location to fill your verification address.'; only When-In-Use/one-time options, never Always/background. Address fields fill and remain editable; Ghana sets GhanaPost option. Deny shows 'Location permission was declined. You can choose your address manually.'; approximate still fills at least country/region; services off shows an error, no crash, no infinite spinner. No location indicator after leaving the screen.

**Needs:** Device geocoder (network)

**Source:** `apps/mobile/app/kyc.tsx`, `apps/mobile/plugins/withForegroundLocationOnly.js`, `apps/mobile/app.json`

## MOBILE-019 · P1 · Live broadcast camera/microphone permissions for host; viewer never prompted

*Surfaces:* android, ios  ·  *Type:* negative/edge

**Before:** Campaign owner on a plan with live streaming; LIVEKIT_* configured; fresh permissions. Second device as viewer.

**Steps:**

1. Owner: campaign detail > Go live > Create live session > 'Start camera and microphone'.
2. Deny camera and microphone at the prompts.
3. Grant via Settings, return, tap Disconnect camera then Start again; toggle 'Camera on'/'Unmute'.
4. Viewer: open the live link, tap 'Watch broadcast'.

**Expect:** Host sees camera and microphone prompts with the live-broadcast purpose strings. Denial shows 'Camera or microphone access failed. Allow access in Settings, then enable the device.' without crash. After granting, video and audio publish. Viewer is never prompted for camera or microphone and sees 'Your camera and microphone remain off.'

**Needs:** LiveKit credentials, store/plan with liveStreaming

**Source:** `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/app/campaign/live.tsx`, `apps/mobile/app/live/[sessionId].tsx`

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

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** Existing account with accessible mailbox; unknown email.

**Steps:**

1. Sign In > 'Forgot password?'; enter the account email; 'Send Reset Link'.
2. Open the email on the phone; tap the reset link.
3. Reset the password on the web page; return to the app and sign in with the new password.
4. Repeat with an unknown email and with the API unreachable.

**Expect:** Neutral 'Request received' message for both known and unknown emails (no account enumeration). Reset link opens the web reset page (no native reset screen exists) and works on mobile browsers. Old password no longer works in the app; existing app sessions are revoked per server policy. API down shows 'Password recovery is temporarily unavailable.'

**Needs:** Email provider

**Source:** `apps/mobile/app/forgot-password.tsx`

## MOBILE-028 · P1 · Biometric lock interaction with system prompts and external sheets (form state preservation)

*Surfaces:* android, ios  ·  *Type:* recovery/idempotency

**Before:** Biometric unlock enabled; permissions not yet granted; Android Paystack test mode; IAP sandbox.

**Steps:**

1. KYC step 1: fill Full name/ID number; step 3: tap 'Use my location' so the OS permission alert appears; answer it.
2. Campaign create step 2: type a story; tap Camera for the cover so the OS camera prompt appears.
3. Pull down Control Center / notification shade while on the donate form with text entered.
4. Android: start a donation so Paystack opens in a browser tab; pay; return.
5. Start an IAP subscription so the store sheet appears; complete it.

**Expect:** Record for each whether the app locks and whether the draft survives. Expected: forms and flows survive temporary system prompts (docs state inactive prompts should only hide, not unmount); purchases and payments still complete and reconcile after unlock (silent restore / payment polling). Source shows iOS 'inactive' and Android 'blur' call lockBiometricSession, which unmounts screens - if drafts are lost or the purchase result is not reflected after unlock, log a P1 defect.

**Needs:** Paystack test keys, App Store/Play sandbox

**Source:** `apps/mobile/src/context/AuthContext.tsx`, `apps/mobile/src/lib/session.ts`, `apps/mobile/app/kyc.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`

## MOBILE-029 · P1 · Biometric unlock after enrollment change, offline, or revoked refresh token

*Surfaces:* android, api, ios  ·  *Type:* negative/edge

**Before:** Biometric unlock enabled on device; ability to change password on web.

**Steps:**

1. Add a new fingerprint/face (or reset Face ID) in OS settings; return and unlock.
2. Re-enable; background; turn on airplane mode; tap 'Unlock with biometrics'; wait 15 s.
3. Online again; change the password on the web; return to the locked app and unlock.

**Expect:** Enrollment change invalidates the protected credential: 'Biometric access changed or expired. Sign in with your password instead.' Offline shows 'Unlock could not reach Ujimora...' after ~15 s with retry possible. Revoked token unlock fails and returns the user to sign-in; no access granted with stale credentials.

**Needs:** Physical devices

**Source:** `apps/mobile/src/lib/biometricVault.ts`, `apps/mobile/src/lib/session.ts`

## MOBILE-030 · P1 · Enable authenticator MFA on the same phone (no second screen to scan)

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Account without MFA; authenticator app (Google Authenticator/Authy/1Password) on the same phone. Run once with biometric unlock OFF and once ON.

**Steps:**

1. Settings > Authenticator protection: enter Current password; tap 'Set up authenticator'.
2. Tap 'Copy setup key'; switch to the authenticator; add the key; copy the 6-digit code.
3. Return to Ujimora; paste into the OTP input; tap 'Confirm and enable MFA'.
4. Also test scanning the QR from a second device, and 'Cancel setup'.
5. Wait more than 10 minutes after setup before confirming.

**Expect:** With biometrics off: setup state (QR, key) survives the app switch; confirmation enables MFA, shows 10 recovery codes and 'Other sessions have been signed out.' With biometrics on: record whether switching apps locks and wipes the setup state; if so, log a P1 defect (user must restart setup). Expired setup shows an error. Cancel does not enable MFA.

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

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Signed-in account; also signed in on web.

**Steps:**

1. Profile > Edit profile and images > Change password; enter a wrong current password.
2. Enter mismatched new passwords.
3. Enter correct current and matching new password; tap 'Update password'.
4. Continue using the app for 2 minutes; check the web session.
5. If biometrics were enabled, background and unlock.

**Expect:** Wrong current password and mismatch show errors. Success shows 'Password updated'. Record whether the phone session continues or is signed out and ensure it is graceful. Other sessions follow server revocation policy. Biometric unlock behaves consistently (either still works or fails cleanly to password sign-in).

**Needs:** None

**Source:** `apps/mobile/app/profile/edit.tsx`, `apps/mobile/src/lib/session.ts`

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

**Before:** Signed-out app; campaign with comments, updates and donor messages.

**Steps:**

1. Open campaign detail; scroll to comments, updates, recent donations.
2. Tap 'Report Campaign' and confirm 'Report'.
3. Try to post a comment.

**Expect:** Comment/update/donation Report buttons are hidden when signed out; comments show 'Sign in to join the conversation.' 'Report Campaign' is visible to signed-out users and posts without auth - expected outcome is either a sign-in prompt or an accepted anonymous report; if it shows 'Could not submit report' log a defect (review notes say Report is for signed-in users).

**Needs:** None

**Source:** `apps/mobile/app/campaign/[id].tsx`, `apps/mobile/src/components/CampaignComments.tsx`

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

**Before:** Paystack test keys including a declined test card.

**Steps:**

1. Start a donation; close the browser tab without paying.
2. Observe 'Awaiting payment confirmation' text 'Closing checkout does not confirm or cancel a payment.'; tap 'Open secure checkout' and pay with a declined card.
3. Wait for the terminal state; tap 'Try again'.
4. Corrupt test: with a debug build, write invalid JSON to the pending key and reopen Donate.

**Expect:** Abandoned checkout remains pending until the provider/expiry resolves it; declined shows 'Payment was not completed'; 'Try again' clears the saved attempt and shows a fresh form with a new idempotency key. Corrupted saved state shows the preserved-attempt error and blocks a new payment rather than risking a duplicate.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/lib/payments.ts`

## MOBILE-058 · P1 · Donation during a live session is attributed to the session (Android) and handed off with context (iOS)

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Active live session; viewer device.

**Steps:**

1. Viewer: live page > 'Support this campaign'; donate 20 GHS (Android) / continue in browser (iOS).
2. Host: watch the studio stats 'GH₵ ... · N donations' and OBS overlay.
3. Donate after the session ends from the same page.

**Expect:** Android donation includes liveSessionId; session amountRaised and successfulDonations increase once after confirmation; overlay reflects privacy toggles. iOS Safari URL carries liveSessionId and web donation is attributed. After the session ends, donations go to the campaign without session attribution.

**Needs:** LiveKit, Paystack test keys

**Source:** `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/campaign/live.tsx`

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

**Before:** Donor with a refundable successful donation and a non-refundable one; staff to decide.

**Steps:**

1. Profile > My Donations; tap 'Request Refund' on the eligible donation.
2. Tap submit without a reason ('Select a Reason' alert); choose a reason; add details; submit; double-tap submit.
3. Open My Refunds; staff approves/rejects; refresh.
4. Confirm the non-refundable donation has no Request Refund button.
5. Deep link ujimora://donations/refund/<id> for your own donation.

**Expect:** Refund Request shows campaign, amount (GH₵ correct decimals), date. One refund created ('Your refund ID is: ...'). My Refunds shows status transitions. Approved refunds reverse the ledger/wallet correctly per REFUNDS_AND_FEES; email notifications sent once.

**Needs:** Paystack refunds (test), email provider

**Source:** `apps/mobile/app/my-donations.tsx`, `apps/mobile/app/refund-request.tsx`, `apps/mobile/app/my-refunds.tsx`, `docs/compliance/REFUNDS_AND_FEES.md`

## MOBILE-062 · P1 · Campaign cashout from the device: fees, caps and duplicate protection

*Surfaces:* admin, android, api, ios  ·  *Type:* recovery/idempotency

**Before:** Campaign owner with eligible balance; saved payout account (bank or MoMo) verified; SPLIT_PROCEEDS_ENABLED off for this campaign.

**Steps:**

1. Campaign detail > Manage campaign; read eligible balance and 'How your balance is calculated'.
2. Choose standard vs early/urgent types; enter an amount over the cap; then a valid amount.
3. Tap submit twice quickly; kill the app right after tapping, relaunch and resubmit the same amount.
4. Choose 'Ujimora Wallet' destination.
5. Staff approves in admin; watch status refresh (30 s poll / resume).

**Expect:** Displayed fee and net match server response ('Fee GHS x; net GHS y'); cap enforced for early/urgent. Double tap yields one payout (idempotency key); after a kill, the server's eligible-balance check prevents a duplicate over-withdrawal (log if two payouts exceed eligibility). Wallet destination credits GHS wallet net amount after approval. Status updates PENDING -> PROCESSING -> PAID.

**Needs:** Paystack transfers (test), admin console

**Source:** `apps/mobile/src/components/CampaignCashout.tsx`, `apps/mobile/app/campaign/manage.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

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

## MOBILE-065 · P1 · Start a campaign on device: gating, validation, uploads and duplicate risk

*Surfaces:* admin, android, api, ios  ·  *Type:* functional

**Before:** Accounts: unverified member; verified member at plan limit; verified member with capacity; plan with collaboration; SPLIT_PROCEEDS_ENABLED on and off.

**Steps:**

1. Unverified: tap Start tab; tap 'Review eligibility' (goes to KYC). At-limit: goes to Subscription.
2. Eligible: step through Basics (title < 5 chars, summary > 140), Story (20-5000 chars, beneficiaries), Goal (goal above plan limit, past end date), Review.
3. Add collaborator emails (invalid one), enable split with shares not summing to 100%.
4. Tap 'Create campaign'; then with proxy drop the response of POST /campaigns and retry.
5. After creation, set up payout from the inline cashout card; tap 'View campaign'.

**Expect:** Gates route correctly. Each validation message blocks progression. Cover upload shows 16:9 crop. One campaign created and shown with status (pending review); partial failures listed with 'do not create it again'. Dropped-response retry: record whether a duplicate campaign is created (no idempotency key in source) - log defect if so. Split toggle only when canSplit.

**Needs:** OpenAI (screening), Cloudinary, admin approval

**Source:** `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app/(tabs)/create.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## MOBILE-066 · P1 · Live broadcast host studio lifecycle

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Owner on a live-streaming plan; LIVEKIT_* configured; environment without LiveKit for negative check; OBS or a browser for the overlay.

**Steps:**

1. Without LiveKit: Go live shows 'Live broadcasting is not configured yet.' and Create disabled.
2. With LiveKit: enter title and goal (try 0 and abc), Create live session; Start camera and microphone.
3. Toggle Show donor names/messages/amounts/Privacy mode; verify on a viewer and overlay.
4. 'Copy private overlay link'; open in a browser; 'Replace overlay link'; confirm old link stops working.
5. 'Share viewer link'. Background the app for 10 s and return; check camera/mic state.
6. 'End broadcast' > confirm.

**Expect:** Studio reflects session state (10 s poll). Toggles apply to viewers/overlay. Rotation invalidates the old overlay link. On background, camera and mic are disabled unless screen sharing and must be re-enabled by the host (contradicts review notes claiming audio continues - update notes). End closes the session for viewers.

**Needs:** LiveKit, plan with liveStreaming

**Source:** `apps/mobile/app/campaign/live.tsx`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/src/components/CampaignManagement.tsx`

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

**Before:** iPad (11-inch and 13-inch) with Stage Manager; release build (supportsTablet true).

**Steps:**

1. Launch in portrait and landscape; rotate on Home, campaign detail, Donate, Settings, KYC, Subscription, live studio.
2. Use Split View 1/3, 1/2, 2/3 and Slide Over; resize in Stage Manager.
3. Open dialogs (SelectionField, Report, date picker) and the notification sheet in each size.
4. Capture screenshots for App Store iPad listing.

**Expect:** Confirm supported orientations match the final Info.plist (from MOBILE-001). No clipped/overlapping content; tab bar usable; dialogs within bounds. Home and splash use module-level window width, so check for stretched or cut-off cards after rotation/resizing and log defects. No crash on size changes.

**Needs:** None

**Source:** `apps/mobile/app.json`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/src/components/SplashScreen.tsx`, `apps/mobile/src/components/SelectionField.tsx`

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

**Before:** iPhone SE (small) and Android 15/16 (edge-to-edge) devices; third-party keyboards (Gboard, SwiftKey).

**Steps:**

1. Focus the last field on: login, register (referral code), forgot password, Donate (Message, Tip, Fee waiver code), Wallet top-up amount, KYC fields, Start a campaign story/split rows, Manage campaign cashout amount, Edit profile password fields, comments box, Report description, Data-rights details, SelectionField search.
2. Type, then scroll; dismiss keyboard by tapping outside.
3. Rotate iPad with keyboard open.

**Expect:** Focused inputs and the primary action remain visible above the keyboard; taps on buttons work while keyboard is open (keyboardShouldPersistTaps). On Android (automaticallyAdjustKeyboardInsets is iOS-only) verify screens still resize with edge-to-edge; log any field hidden behind the keyboard.

**Needs:** None

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/app/campaign/create.tsx`, `apps/mobile/app/(auth)/login.tsx`

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

**Before:** Campaign with slug and one without; organization; live session; creator handle; affiliate account.

**Steps:**

1. Campaign detail > Share: share to WhatsApp, Messages, Copy.
2. Organization > Share; Live viewer 'Share broadcast'; Studio 'Share viewer link'; Creator studio share page link; Affiliate share referral link.
3. Open each shared link on another phone (browser) and on desktop.
4. Cancel a share sheet.

**Expect:** Messages contain the title/summary and correct https URLs (/c/<slug> or /campaigns/<id>, /organizations/<id>, /live/<id>, /creators/<handle>, referral link) that open on web. iOS share includes the URL field. Cancel causes no error. Share analytics recorded only for completed campaign shares (Android always reports shared - note).

**Needs:** Web app

**Source:** `apps/mobile/src/components/ShareCampaign.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/app/organization/[id].tsx`, `apps/mobile/app/live/[sessionId].tsx`, `apps/mobile/app/affiliate.tsx`, `apps/mobile/app/creator.tsx`

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

**Before:** Network Link Conditioner (iOS) / emulator network profiles (Android): 3G, Edge, 100% loss; proxy to inject 500/503/timeouts; Render cold-start delay.

**Steps:**

1. On 3G: load Home, campaign detail, Wallet, Settings, Subscription; upload a 3.9 MB KYC image.
2. Mid-upload switch to 100% loss; then restore.
3. Inject 500 on /wallets, /profile, /notifications, /campaigns/:id/comments.
4. Post a comment and toggle a Settings switch while requests fail.
5. Simulate a 45 s API cold start on first launch.

**Expect:** Every screen shows a readable error with a retry (Try again / Retry / Refresh) and never an infinite spinner that blocks navigation; failed Settings toggles revert and show 'Could not save that setting'; comment failure alerts 'Could not post'. Upload failure shows an error and re-enables Continue; no half-applied state. Raw technical strings (e.g. 'Network request failed', JSON parse errors) are logged as UX defects.

**Needs:** Proxy/network shaping tools

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/CampaignComments.tsx`

## MOBILE-015 · P2 · https web links and in-app notification 'View details' routing

*Surfaces:* android, ios, web  ·  *Type:* cross-platform

**Before:** App installed; account with at least one in-app notification carrying a path (e.g. donation received, KYC decision).

**Steps:**

1. Tap an https://app.ujimora.com/c/<slug> link in WhatsApp/Messages.
2. In the app tap the bell, open a notification and tap 'View details'.
3. Repeat for notifications whose path is /donations/refund/<id>, /campaigns/<id>, /subscription.

**Expect:** https links open in the browser (no universal/app links are configured; record as expected until domain association is added). 'View details' navigates to the correct native screen via resolveNativePath; unknown paths go to the not-found screen, never a blank screen.

**Needs:** Staging notifications data

**Source:** `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/navigation/resolvePath.ts`, `apps/mobile/app.json`

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

**Before:** Signed-in account with an open campaign detail page, wallet, notifications and a pending Android payment.

**Steps:**

1. Background the app; from another device donate to the campaign, send a notification-triggering event, and complete the pending payment.
2. Resume after 1 minute and after 30 minutes.
3. Check campaign totals, bell badge, PaymentStatus, Wallet, Dashboard, creator page, live studio stats.

**Expect:** On resume, campaign detail, notifications (bell count), PaymentStatus, creator page and live stats refresh automatically (AppState active listeners/polls). Wallet and Dashboard may need navigation - log stale data if it persists after returning to the screen. No crash from timers firing after long background.

**Needs:** Paystack test keys

**Source:** `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/src/context/NotificationContext.tsx`, `apps/mobile/src/hooks/useCampaigns.ts`, `apps/mobile/app/(tabs)/wallet.tsx`, `apps/mobile/app/dashboard.tsx`

## MOBILE-084 · P2 · In-app notification inbox

*Surfaces:* android, api, ios  ·  *Type:* functional

**Before:** Account with several unread in-app notifications (enable activity alerts in Settings first).

**Steps:**

1. Observe bell badge count (and 99+ with >99).
2. Tap bell; verify list, timestamps, 'New' markers; tap 'Mark as read' (offline once).
3. Tap 'View details' on a notification with a path.
4. Close with 'Close notifications' / swipe down (iOS pageSheet) / Android back.
5. Sign out: bell strip disappears.

**Expect:** Badge equals unread count and updates after mark read; failures show error and keep state consistent. View details routes correctly. Empty state 'You’re all caught up'. Bell never shown when signed out; list refreshes every 30 s while active and on resume.

**Needs:** None

**Source:** `apps/mobile/src/components/NotificationBell.tsx`, `apps/mobile/src/components/OwnerNotifications.tsx`, `apps/mobile/src/context/NotificationContext.tsx`

## MOBILE-085 · P2 · Settings preferences: activity alerts, newsletter, privacy toggles, language

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** Signed-in account with unverified email; leaderboard with this user's donations.

**Steps:**

1. Activity alerts and emails: enable a category; tap 'Send verification link'; verify email; 'Check verification status'.
2. Marketing emails and newsletter: opt in; 'Resend newsletter confirmation'; confirm via email; opt out.
3. Toggle 'Show on Leaderboard' off; open Leaderboard (all periods).
4. Toggle 'Anonymous Donations' on; make a donation (Android) and check campaign recent donations.
5. Language: choose Twi; relaunch.

**Expect:** Alerts/emails default off and require verified email; confirmation emails arrive once (double opt-in for newsletter). Leaderboard hides the user when off. Anonymous preference shows 'Anonymous' publicly. Language saves to profile but UI stays English (app not localized) - confirm this is acceptable or hide the picker. Failed saves revert with error banner.

**Needs:** Email provider

**Source:** `apps/mobile/app/settings.tsx`, `apps/mobile/src/components/ActivityAlertSettings.tsx`, `apps/mobile/src/components/NewsletterSettings.tsx`, `apps/mobile/app/leaderboard.tsx`
