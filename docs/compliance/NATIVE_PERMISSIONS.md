# Native permission audit — 13 September 2026

Status: generated configuration verified; final merged/signed artifacts and physical-device behavior remain open (C17/C18).

Google Play requires permissions to support current disclosed features, with incremental consent and the minimum necessary scope. System pickers should replace broad media access where sufficient. [Current sensitive-permissions policy](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en). The page announces additional location/contact changes effective 27 January 2027; those are future requirements, not evidence of a current violation. Apple's privacy rules also require appropriate purpose disclosures and data minimization. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy).

## Generated Android configuration

`EXPO_NO_DOTENV=1 npx expo config --type introspect --json` was run from `apps/mobile`, before and after the change. Evidence: `/tmp/ujimora-native-permission-introspection{,-after}.json`. Introspection is not the final Gradle library-manifest merge.

| Permission group | Evidence and disposition |
| --- | --- |
| Legacy read storage | `READ_EXTERNAL_STORAGE` was present through SDK 32. Now explicitly blocked. The installed Expo ImagePicker library launches `PickVisualMedia` (or its system content-picker path) without calling its media-library permission request; `MediaUploadField` uses this selection path. No app caller requests broad media-library permission. |
| Legacy write storage | Retained with the generated SDK-32 cap. Installed ImagePicker `ensureCameraPermissionsAreGranted` requires it below Android 10; the project SDK defaults still support API 24. Removing it outright would break that supported camera path. Review the final manifest/device matrix before narrowing this dependency further. |
| Broad modern media, background location and overlay | All six blocked permissions, including legacy read storage, have `tools:node="remove"` directives. Other blocked entries are `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`, `ACCESS_BACKGROUND_LOCATION` and `SYSTEM_ALERT_WINDOW`. |
| Camera and audio | Retained for explicit capture/broadcast. `MediaUploadField` offers a file-selection alternative when camera access is denied. Physical permission-denial and live broadcast tests remain required. |
| Foreground coarse/fine location | Retained for optional address filling. Manual entry remains available; inspect actual precision and geocoder traffic on devices before final disclosure. |
| Biometric/fingerprint | Retained for optional post-login account protection; verify protected credential reads and denial/enrollment changes on devices. |
| Network, audio settings, wake lock, Bluetooth, vibration and billing | Present in generated configuration. Trace final linked SDK permissions, foreground service types and runtime use in the release artifact; configuration presence alone does not justify a store declaration. |

## Generated iOS configuration

Background modes contain only `audio`, with no always-location usage description. Camera, microphone, selected photos, foreground location and Face ID have purpose strings. Introspection also includes Expo local-network discovery/Bonjour descriptions: check the production archive to determine which development declarations remain. Do not claim this development-oriented output is the final App Privacy report.

## Remaining acceptance evidence

Inspect the final Android merged manifest/AAB and iOS archive, including transitive SDK privacy manifests, required-reason APIs, foreground services, target SDK and native-library alignment. Test selected-file/camera paths on supported older and current Android versions, denial/manual alternatives, Face ID/fingerprint opt-in and revocation, location scope, live audio/screen sharing, and actual network traffic. No signed build, device permission interaction or store approval was produced in this audit.

## Android cloud backup — 13 September 2026

Generated application configuration initially had `android:allowBackup="true"`. The app now explicitly sets Expo `android.allowBackup: false`; before/after introspection confirms the generated value is false while SecureStore backup/extraction resource references remain intact. Evidence: `/tmp/ujimora-native-backup-introspection.json` and `/tmp/ujimora-native-backup-disabled.json`. This keeps app-local account summaries and payment recovery records out of automatic cloud backup under the documented Android setting. It does not erase pre-existing backups, change local records, or prove a released binary has this setting. A new native build is required.

[Android backup guidance](https://developer.android.com/identity/data/autobackup) explicitly notes that some Android 12+ manufacturers still allow device-to-device transfer when cloud backup is disabled. The subsequent app-wide rules below replace the credential-only exclusions; final merged manifest and physical restore/transfer tests remain open. iOS backup policy is separate and unverified.

## App-wide backup and device-transfer exclusions

`plugins/withPrivateBackupRules.js` now installs app-owned legacy backup and Android 12+ extraction XML. Both cloud and device-transfer sections exclude all nine supported storage domains at their roots, covering ordinary and device-protected files, databases, preferences and app external storage. SecureStore automatic rule installation is disabled because these broader rules also exclude its preferences. `allowBackup` remains false. No local data is deleted by this configuration.

An isolated `expo prebuild --platform android --no-install` completed at `/tmp/ujimora-backup-prebuild` after fixing that temporary checkout's workspace dependency links. Its generated manifest points to both generated XML resources; XML parsing verified every exclusion and absence of include overrides. Plugin syntax and whitespace checks pass. Log `/tmp/ujimora-backup-prebuild.log`. This is generated native-project evidence, not Gradle's final merge or an installed-device test. Final Android cloud restore, D2D behavior, previously retained backups and iOS lifecycle remain explicit release gates. Restoring a new device must use account/server history rather than copying local payment recovery state.

## Repeatable iOS artifact privacy inventory

Run `python3 scripts/compliance/inspect-ios-privacy.py /path/to/Ujimora.app` on the actual extracted app, including the app inside a release xcarchive. The JSON records the bundle version/platform, executable SHA-256, and every nested privacy manifest's path, hash and declarations. It fails for missing app directories, malformed plist data or missing executables; it does not infer compliant collection, correct reasons, SDK signatures or complete SDK coverage from presence alone.

The command was exercised on the earlier successfully built simulator bundle at `/tmp/ujimora-store-ios-derived/Build/Products/Debug-iphonesimulator/Ujimora.app`. Inventory `/tmp/ujimora-ios-simulator-privacy-inventory.json` reports `iPhoneSimulator`, version 1.0.0/build 1, executable SHA-256 `47bc07c6ab59033bad7a33b6e4f1bbfefd7136c1fd83bd153193c326bc4bcee3` and 16 manifests. The temporary source copy has no Git metadata, so this is not evidence for current main or a release archive. Required-reason categories include file timestamps, preferences, boot time and disk space; nested WebRTC declarations are separately included. Empty collected-data arrays must not replace the feature-level data inventory or store-console answers.

Current Android release-manifest merge was started in `/tmp/ujimora-backup-prebuild/android` with Java 17 and SDK 36: `./gradlew :app:processReleaseMainManifest --no-daemon --max-workers=2`. Log `/tmp/ujimora-android-manifest-merge.log`; running session 53371. Downloaded Gradle 9; final dependency resolution/merge outcome is not yet known. Do not report a final merged manifest until that task completes successfully and its output is inspected.

## iOS local backup behavior checked

The installed AsyncStorage 2.2.0 implementation sets `NSURLIsExcludedFromBackupKey` on its storage directory during setup. Its `RCTAsyncStorageExcludeFromBackup` Info.plist setting defaults to true when absent; current app configuration does not override that default. Both ordinary credentials and biometric credentials use `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` in `session.ts` and `biometricVault.ts`. These are distinct controls: the AsyncStorage flag covers its directory, while the Keychain option covers the saved credentials.

The existing Ujimora Parity iPhone simulator's app container was identified by its container metadata. Foundation resource-value inspection of `Library/Application Support/com.ujimora.app/RCTAsyncLocalStorage_V1` returned `isDirectory=true isExcludedFromBackup=true`. No account/payment contents were read. This confirms that directory flag on the previously installed simulator, not cloud-backup deletion, whole-device transfer behavior, a current signed binary or physical Keychain security. AsyncStorage logs but does not throw if setting the flag fails; physical release checks must verify the actual flag and restore outcome. Upload/cache files outside this directory need separate lifecycle review.

Android manifest verification session 53371 ended after the NDK installation and plugin compilation, with a bundler failure resolving a mobile dependency from the standalone temporary copy. The second attempt (55902) also ended at that dependency because search paths alone did not include the source in Metro's file map. Only `/tmp/ujimora-backup-prebuild/metro.config.js` was changed to mirror the actual workspace dependency paths and watch folder; repository Metro config remains unchanged. Third attempt session 20258 uses `/tmp/ujimora-android-manifest-merge-final.log`; release JavaScript bundling passed (2181 modules), but final manifest task outcome remains pending at this checkpoint.

## Completed Android release manifest merge — 13 September 2026

Session 20258 finished with exit 0 (`BUILD SUCCESSFUL`, 5m32s, 124 tasks); log `/tmp/ujimora-android-manifest-merge-final.log`. Parsed output: `/tmp/ujimora-backup-prebuild/android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`, SHA-256 `babf2277286a9b97263fc7cc3ce61b30ca02b6c88c03e8b1068187b680f46594`. Inventory is `/tmp/ujimora-android-merged-manifest-inventory.json`.

Direct XML assertions confirm target SDK 36/minimum 24, allowBackup=false, both app-owned backup resource references, all nine root exclusions in legacy/cloud/device-transfer rules, no include overrides, and absence of all six explicitly blocked permissions. The merged manifest contains 37 permission declarations, including library-provided notification, boot, badge and billing permissions; generated configuration alone did not enumerate this final set.

Follow-up discovered: the enabled WebRTC mediaProjection foreground service has no matching FOREGROUND_SERVICE_MEDIA_PROJECTION permission in the merged output. Audit and repair the actual screen-sharing path before claiming device support. The unused location foreground service and transitive notification components also require minimization review. These are open findings, not dismissed because Gradle succeeded.

The temporary native project contains the backup-plugin checkpoint around d4133c6 and predates upload-cache cleanup c55f8df. Only temporary Metro workspace visibility was adjusted. This is a completed release-variant manifest task, not full native compilation, a signed APK/AAB, 16 KB alignment verification, current-main release provenance, installed-device evidence or store approval.

## Media-projection permission correction

The installed LiveKit Expo plugin README explicitly requires both foreground-service permissions; enabling its service does not add them automatically. `apps/mobile/app.json` now declares FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PROJECTION. This matches [Android media-projection documentation](https://developer.android.com/media/grow/media-projection) for the existing mediaProjection service. `LiveVideo.tsx` starts capture from the host button; installed WebRTC code invokes createScreenCaptureIntent and only launches the service after RESULT_OK, rejecting denial. Physical lifecycle behavior remains unverified.

Isolated prebuild passed, followed by Gradle release-manifest session 95412 exit 0 in 37s (`/tmp/ujimora-screen-share-{prebuild,manifest}.log`). XML assertions verify both permissions, the matching service type, target SDK 36, retained backup references/disabled backup, and absence of every configured blocked permission. Merged manifest SHA-256: `118be7a4d0c0011e09f5fa0444258a6bb72766b4cd74108333535c94d0eea288`. The copy retains the earlier native source plus this configuration delta, not a complete current-main binary. An initial command accidentally prebuilt the repository root; its generated files were moved to temporary storage and its package edits fully reverted before this validation. No root native project or dependency changes are included.

The source/merged-manifest permission gap is closed. Signed-device consent/denial/revocation/repeated-session and background microphone behavior, service notification, and Play Console foreground-service declarations remain open in STORE_SUBMISSION.md. No full native compilation or store approval is inferred.

## Foreground-only address lookup

Source search finds only the KYC one-shot `requestForegroundPermissionsAsync` / `getCurrentPositionAsync` / `reverseGeocodeAsync` path and no app use of persistent location tasks. Installed Expo Location implements the single fix via FusedLocationProviderClient separately from LocationTaskConsumer and its LocationTaskService.

The new `withForegroundLocationOnly` config plugin adds a named `tools:node="remove"` service marker, following [Android manifest merge guidance](https://developer.android.com/build/manage-manifests), while retaining coarse/fine foreground permissions. FOREGROUND_SERVICE_LOCATION is explicitly blocked alongside ACCESS_BACKGROUND_LOCATION. The actual device address lookup, denial/manual alternative and signed artifact remain release checks.

Isolated prebuild and release-manifest session 99898 finished exit 0 (1m2s); logs `/tmp/ujimora-location-service-{prebuild,manifest}.log`. Final XML assertions verify the location service is absent, foreground coarse/fine location and screen-sharing service/permission remain, all seven blocked permissions are absent, target SDK stays 36 and backup controls remain. Manifest SHA-256 `d7d9047094a7e199686971a1416b304d0e7c37c0438c32a4413b97f1eb596d45`. Plugin syntax and whitespace checks pass. This closes the unused service declaration, not installed-device or full native build verification.

## Current-source Android APK compilation checkpoint

Fresh native project `/tmp/ujimora-android-69d94fa` was populated with `git archive` from source commit `69d94fa585c40eeaa09478d3f5f41dfda73bef9b`, not the older evolving prebuild copy. Post-prebuild byte comparison covers all 184 tracked mobile files; only metro.config.js differs to resolve the temporary workspace dependency overlay. `build-provenance.json` records this comparison and root lockfile SHA-256 `450ad8fe19cf884eb01a4a5b22980f46bf5b4cf1feca33f79bdefa8c8b0d3204`. Dependencies use the existing workspace installation; this is not a clean-install proof.

Prebuild completed successfully (`/tmp/ujimora-android-current-prebuild.log`). Full `:app:assembleRelease --no-daemon --max-workers=2` is running as session 37305 with Java 17 and Android SDK 36, log `/tmp/ujimora-android-current-assemble.log`. The generated release variant uses the local debug signing configuration, explicitly not the production/store key. No APK compilation or alignment pass is claimed until terminal output and the artifact are inspected.

After a successful build, inspect the APK with apksigner, verify packaged permissions/backup/auto-init metadata, run SDK zipalign `-v -c -P 16 4`, and inspect every 64-bit native library's LOAD and GNU_RELRO alignment using NDK llvm-objdump/llvm-readelf. [Android's current page-size guidance](https://developer.android.com/guide/practices/page-sizes) distinguishes ELF alignment, ZIP alignment and actual 16 KB device testing; a manifest or JS bundle proves none of these. Final store signing/AAB delivery and physical lifecycle tests remain separate gates.

### Exported clipboard provider inspected

Installed Expo Clipboard's ClipboardFileProvider deliberately requires exported=true; changing that flag alone makes attachInfo throw. Its XML exposes only cache/.clipboard/, and getFileForUri canonicalizes the requested path and requires it to remain under the configured root. Source searches find app text-copy calls, not setImageAsync. Recovery-code download files use cache/ujimora-recovery-codes-<timestamp>.txt, outside the clipboard provider root, and the helper deletes them in finally after share completion/failure. Existing recovery-code tests cover success/failure cleanup. The manifest's exported flag alone therefore does not prove these files are exposed through that provider. No dependency patch or false-positive security claim was made. Device clipboard history, share-recipient retention and interrupted-process cache cleanup remain separate risks to validate.

Build checkpoint: APK assemble session 37305 and API regression session 67839 were re-polled and remain live. Active ninja/clang processes show native arm64 appmodules and expo-modules-core compilation; the quiet Gradle log is not a terminal failure. Build-generated node_modules intermediates must not be removed while compilation is running.

## WebRTC ELF compatibility finding

Read-only inspection of the resolved Maven AAR io.github.webrtc-sdk:android:144.7559.05 found both 64-bit libjingle_peerconnection_so.so LOAD segment alignments at 0x4000. However, Android's separately documented `(GNU_RELRO VirtAddr + MemSiz) % 0x4000` check is nonzero: arm64-v8a 0x2000, x86_64 0x3000. This is an open compatibility finding, not a claimed observed crash. NDK 27.1 llvm-readelf output/hashes are recorded in `/tmp/ujimora-webrtc-elf-inspection/inventory.json`; source AAR SHA-256 `03d074e0e4e07866876f7d447b5ddb53caabefdcfae9f8ff95b15e2bff557a71`. Final APK ZIP alignment and runtime checks remain distinct.

Maven Central metadata was fetched directly (`/tmp/ujimora-webrtc-maven-metadata.xml`). Candidate 144.7559.15 was downloaded for inspection only, not installed or selected by the build. Its arm64 RELRO remainder is zero, but x86_64 remains 0x2000; both LOAD alignments are 0x4000. Candidate AAR SHA-256 `fc7c8d027eb33860ccbb7847988f7f942d44a92d1f575348bba6c0250cde4071`, details `/tmp/ujimora-webrtc-elf-inspection/candidate-144.7559.15.json`. This same-major candidate is therefore not a proven complete fix. Metadata also lists 150.7871.01; compatibility and artifact evaluation remain open before choosing an upgrade or rebuilding upstream. Do not remove a supported ABI merely to hide a failed check.

Reference: [Android ELF and RELRO checks](https://developer.android.com/guide/practices/page-sizes). Current APK build 37305 and API regression 67839 remain live on their original source; no dependencies or code changed during this inspection.

### Repeatable ELF checker and runtime preparation

`scripts/compliance/inspect-android-native.py <APK-or-AAR> --readelf <NDK-llvm-readelf>` inventories each packaged arm64-v8a/x86_64 library, SHA-256, LOAD alignment and RELRO end remainders. It uses generated temporary filenames rather than extracting archive-controlled paths; missing 64-bit libraries are not a pass. Exit 1 reports alignment findings; ZIP alignment, signing, runtime and store checks are explicitly outside its scope.

The script reproduced both failing 64-bit RELRO checks in newer candidate 150.7871.01 (exit 1): arm64 0x3000, x86_64 0x2000, despite 0x4000 LOAD alignment. AAR hash `0a1627b1a48c2bc17d9a40d62fc47bd45166f44a92d1f575348bba6c0250cde379b0`; `/tmp/ujimora-webrtc-repeatable-check.json`. No upgrade applied. This extends the candidate evaluation; it does not establish a runtime crash or a resolved compatibility gate.

SDK catalog confirms dedicated Android 35 Google APIs 16 KB ARM image availability. Installation has started, `/tmp/ujimora-android-16kb-image-install.log`; no emulator boot/page-size/device behavior is claimed. ADB inventory had no connected devices. Full APK assemble 37305 and API regression 67839 remain live on source 69d94fa; generated native code/dependency intermediates must remain intact.

### Intermediate native-library scope expanded

The running build produced eight arm64 and eight x86_64 intermediate libraries (appmodules, React Native/JSI, fbjni, libc++, SVG, screens and safe-area codegen). An inspection-only ZIP at `/tmp/ujimora-native-intermediate-inspection.aar` collects those files for the checker; it is not a built AAR/APK. The checker exits 1: all 16 have LOAD alignment >=16 KB, but none has a zero RELRO-end remainder. Exact hashes/results: `/tmp/ujimora-native-intermediate-elf.json`. Generated arm64 build.ninja link flags include max-page-size=16384 and do not include common-page-size; the finding is broader than the WebRTC dependency. Do not claim a WebRTC-only upgrade resolves it, and do not confuse this incomplete intermediate inventory with the final packaged set.

Actual 16 KB device loading, compilation/packaging provenance and applicable toolchain/prebuilt-library remediation remain the next checks. Image installation 74629 is confirmed live with a growing SDK temporary package (224 MB observed), APK 37305 has reached stripReleaseDebugSymbols, and API regression 67839 remains live. No process was restarted or dependency altered.

### Full APK build retry after terminal setup failure

Session 37305 finished exit 1 at createBundleReleaseJsAndAssets: Metro could not resolve ./node_modules/expo-router/entry through the temporary directory-level node_modules symlink. Native compilation progressed, but no successful APK is claimed. The failed process was allowed to finish before correcting its temporary environment. The directory symlink was replaced with the same actual overlay directory of individual package symlinks used by the earlier successful manifest builds; no repository/dependency source changed.

Retry session 37597 runs the same assembleRelease task, `/tmp/ujimora-android-current-assemble-retry.log`. It explicitly sets EXPO_PUBLIC_API_URL=https://api.ujimora.invalid/api/v1 and EXPO_NO_DOTENV=1 for startup/native-loading tests. The archived source's production API module deliberately throws without an HTTPS endpoint; the earlier environment had none. The non-routable test address avoids production traffic and does not support API/provider functional validation. Provenance JSON was updated; local debug signing and source 69d94fa remain unchanged. API regression 67839 and 16 KB image installation 74629 remain under observation.

### Packaged APK build and alignment results — 13 September 2026

Retry session 37597 completed exit 0: BUILD SUCCESSFUL in 6m 6s, 985 tasks. The archived 69d94fa APK is `/tmp/ujimora-android-69d94fa/android/app/build/outputs/apk/release/app-release.apk`, SHA-256 `e661d60308d058cbe4d19362e6d10317690e24f04d571cc80da499dd4fea147a`. This is the documented local debug-signed release variant with a non-routable test API, not a production/store-signed or provider-functional artifact.

Build-tools 36.0.0 `zipalign -v -c -P 16 4` completed exit 0, Verification successful (`/tmp/ujimora-final-apk-zipalign.log`). The repeatable ELF checker completed exit 1 against the actual APK: all 48 packaged 64-bit libraries pass LOAD alignment, while 41 have nonzero RELRO-end remainders (`/tmp/ujimora-final-apk-elf.json`). Thus ZIP alignment is verified but the separate RELRO finding remains unresolved; no runtime crash or device compatibility pass is inferred. The dedicated 16 KB image installation and current API regression remain live at this check.
