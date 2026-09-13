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

### Interrupted recovery-code export cleanup

Native startup now removes prior temporary recovery-code exports left when a crash interrupted the share-sheet finally block. Cleanup is restricted to immediate cache filenames matching ujimora-recovery-codes-<safe integer timestamp>.txt whose timestamp precedes startup cleanup invocation. Current/future exports, unrelated files and path traversal names remain untouched; user-saved copies outside the app cache are not scanned. Every matched removal is attempted; failures yield only a fixed warning and retry at next startup. Existing immediate finally cleanup remains.

All 105 mobile tests/23 files, types/lint and Android JavaScript export pass. Tests verify scope, preservation and failure handling. Logs `/tmp/ujimora-recovery-cleanup-{tests,types,lint,export}.log`. Existing native APK 69d94fa predates this JavaScript delta; final device/processor/clipboard/backup gates remain open. API regression 24306 remains active on unchanged API baseline 0bb30ee; SDK image installation 74629 remains active.

### Actual packaged APK permission and backup-resource verification

Android apkanalyzer decoded the successful archived 69d94fa APK, rather than a generated source manifest. Parsed assertions confirm min SDK 24/target SDK 36, allowBackup=false, both Firebase auto-init/analytics metadata false, all seven explicitly blocked permissions absent, LocationTaskService absent, and media-projection service plus both foreground-service permissions present. One-shot coarse/fine location permissions remain. Full permission inventory `/tmp/ujimora-final-apk-manifest-checks.json`; decoded manifest SHA-256 `22407b6ccee433d15ecd8ec5ae3a57aaf8936bde4a83f43a9718ba245b568b2d`.

AAPT resource-table inspection resolves manifest backup references 0x7f15000e/0x7f15000f to packaged res/Vk.xml and res/m3.xml. Apkanalyzer decoded both; parsed assertions prove all nine storage domains excluded at path `.` for legacy full-backup, cloud-backup and device-transfer. Decoded backup SHA-256 `4d7c79acb6045b86b7aa2c04ccb35663d3ed45154b2b2dea01ca69a477eb07ff`, extraction SHA-256 `60fcfa7ac685d16e5a307e1107e68eeaaf6f56a61253470973191eea6e67b032`. Files `/tmp/ujimora-final-apk-{backup,extraction}.xml`.

Scope remains local debug-signed release-variant APK, source 69d94fa and deliberately non-routable API. Subsequent recovery-cache JavaScript changes are not included. These artifact assertions do not establish physical restore behavior, historical-backup erasure, SDK network behavior, RELRO compatibility or store approval. API 24306 and SDK image 74629 remain confirmed live.

### Dedicated 16 KB emulator startup evidence

SDK image installation 74629 completed exit 0. Created new AVD Ujimora_Compliance_16KB using Android 35 google_apis_ps16k/arm64-v8a, leaving existing user AVDs untouched. Emulator session 63606 is running headless on emulator-5580. Boot completion reports 1 and getconf PAGE_SIZE reports 16384. The archived 69d94fa APK installed successfully (`/tmp/ujimora-16kb-apk-install.log`).

Initial shell setprop attempts lacked permission; after restarting adbd as root on this dedicated emulator, readback verifies bionic.linker.16kb.app_compat.enabled=false and pm.16kb.app_compat.disabled=true per Android guidance. Cold launch completed Status:ok, TotalTime2123ms, process3848; ReactNativeJS logs Running main, and activity dump identifies MainActivity as topResumedActivity. Crash buffer empty at observation. Logs `/tmp/ujimora-16kb-{launch,app,crash,activities,process-maps}.log`. This establishes native/JS startup on this ARM Android35 16KB image; no physical-device, x86_64, full UI/permission/media, provider or signed-store pass is inferred. The non-routable API prevents provider functional testing. Packaged RELRO findings remain open despite observed startup, since this does not exercise every library/path/version.

Reference: https://developer.android.com/guide/practices/page-sizes (environment verification and backcompat controls, checked 13 September 2026). Root API regression24306 remains active and unchanged; newer dispute fix310e4b9 is published from the isolated checkout and awaits root fast-forward after completion.


### App CMake RELRO correction — 13 September 2026

Rechecked [Android's current page-size guidance](https://developer.android.com/guide/practices/page-sizes): the RELRO end-alignment check remains explicitly required, and NDK r27 requires both max-page-size=16384 and common-page-size=16384 linker flags. The previous LOAD-only result must not be relabeled a pass because startup succeeded.

Added `withAndroidPageAlignment` to Expo configuration. It adds both flags through CMAKE_SHARED_LINKER_FLAGS for the app's CMake invocation. Expo Android prebuild succeeds and the generated app build file contains the option exactly once; affected lint passes. This applies to appmodules and codegen libraries in that invocation, not prebuilt AARs or separate dependency CMake builds.

Built the archived 69d94fa native project with the same option using NDK27.1/JDK17 for ARM64 and x86_64. Both builds pass (79s and40s). All eight app-compiled libraries (appmodules, screens/SVG/safe-area codegen on both ABIs) now pass LOAD and RELRO checks with zero RELRO end remainders. Eight copied dependencies in that output still fail RELRO: libc++_shared, fbjni, jsi and reactnative on both ABIs. The combined inspection archive intentionally still exits1; it is not a verified APK/AAR release. Separately built Expo/screens libraries and other packaged third-party binaries retain their earlier unresolved findings.

Initial build attempts finished unsuccessfully due to missing SDK location and Java25 restricted-method output, then the corrected SDK/JDK17 environment built successfully. Logs `/tmp/ujimora-common-page-native-build-jdk17.log`, `/tmp/ujimora-common-page-native-x86-build.log`, `/tmp/ujimora-common-page-native-elf.json`, `/tmp/ujimora-page-alignment-prebuild.log`, `/tmp/ujimora-page-alignment-lint.log`. This verifies the linker correction against archived native source, not a final signed current-source artifact or renewed runtime/provider acceptance. Final rebuilt dependencies, all packaged libraries, ZIP alignment and device paths remain required.


### Separate dependency CMake builds — 13 September 2026

The page-alignment plugin now registers an Android-library callback in the root Gradle file before Expo project initialization. It supplies the same two linker flags to dependency CMake invocations, covering the source builds that the app-only option cannot reach. Prebuild confirms the callback appears once before initialization; Java-only library projects still have no CMake path. No dependency source or prebuilt binaries are patched.

The archived native build completes successfully in41s under NDK27.1/JDK17. All six rebuilt Expo Modules Core, Expo Updates and React Native Screens libraries on ARM64/x86_64 pass both LOAD and RELRO checks, with zero end remainders. Combined with the earlier eight app/codegen libraries, 14 source-built libraries have verified alignment. The standalone inspection archive covers only those six dependency outputs and is not a release AAR/APK.

Logs `/tmp/ujimora-dependency-page-native-build.log`, `/tmp/ujimora-dependency-page-native-elf.json`, `/tmp/ujimora-dependency-page-prebuild.log`, `/tmp/ujimora-dependency-page-lint.log`. Remaining prebuilt runtime/media libraries, final current-source packaging/signing and runtime paths still require remediation/verification. This supersedes the prior unresolved status only for these six source-built outputs.


### Prebuilt runtime and fbjni candidates — 13 September 2026

Maven Central metadata still lists fbjni0.7.0 as latest (`/tmp/ujimora-fbjni-maven-metadata.xml`). The existing ReactAndroid0.83.10 and fbjni0.7.0 AARs both contain libc++_shared.so and libfbjni.so. An NDK setting alone therefore does not establish which runtime ends up packaged; final artifact provenance must be checked.

Installed NDK28.2.13676358 (r28c) side by side without changing the app's selected NDK. Its actual bundled libc++_shared.so passes LOAD checks on both64-bit ABIs, but ARM64 has RELRO-end remainder0x2000; x86_64 has zero. The runtime inspection exits1 (`/tmp/ujimora-ndk28-runtime-elf.json`). Do not select or label this runtime compliant merely from the NDK version. NDK29.0.14206865 installation is now running in session88258 (`/tmp/ujimora-ndk29-install.log`) for independent inspection; do not restart while live.

Fetched the exact [fbjni v0.7.0 source](https://github.com/facebookincubator/fbjni/tree/v0.7.0), commit474795fa9ff0dda60b838871171be935432bae16, into `/tmp/ujimora-fbjni-0.7.0`; source worktree is unchanged. CMake3.22.1/Ninja, Android API24, shared STL and NDK28.2 builds with both page-size flags pass for ARM64/x86_64. Both resulting libfbjni.so files pass LOAD+RELRO checks. Each retains all300 original exported facebook::jni symbols; symbol presence is not full ABI/runtime compatibility proof.

Evidence: `/tmp/ujimora-fbjni-{arm64,x86}-{configure,build}.log`, `/tmp/ujimora-fbjni-rebuilt-elf.json`, `/tmp/ujimora-fbjni-abi/exports.json`. Candidate outputs remain under `/tmp/ujimora-fbjni-aligned`; they are not installed into the app or published as Maven artifacts. Final dependency substitution, bundled-copy elimination, linking, packaged-runtime provenance and device JNI/media paths remain open. No prebuilt release gate is closed by these candidate builds alone.

The build recipe uses the unchanged pinned source with `cmake -S <source> -B <output>/<abi> -G Ninja`, the NDK's `build/cmake/android.toolchain.cmake`, `ANDROID_ABI` set to each64-bit ABI, `ANDROID_PLATFORM=android-24`, `ANDROID_STL=c++_shared`, `CMAKE_BUILD_TYPE=Release`, and `CMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384`; then `cmake --build <output>/<abi> --parallel 4`. Use explicit SDK CMake/Ninja paths as recorded in configure logs.


### NDK29 candidate rejected and RELRO gate hardened — 13 September 2026

NDK29 installation88258 completed exit0; source.properties confirms29.0.14206865 (r29). Its actual bundled libc++_shared.so has16KB LOAD alignment on both64-bit ABIs, but RELRO end remainders are0x3000 on ARM64 and0x2000 on x86_64. Neither candidate meets the documented RELRO check. The app's selected NDK and packaged runtimes remain unchanged. Evidence `/tmp/ujimora-ndk29-runtime-elf.json`; archive SHA2562e93de864c65115d14a6e73f9dca644e45c5b09f95f26e764b3a7aba6ef0a8a0. The inspection archive is not a release AAR.

Rechecked Android's current page-size guidance, including required RELRO enablement and (VirtAddr+MemSiz)%0x4000. Hardened inspect-android-native.py so missing RELRO cannot accidentally pass via an empty remainder list. Five CLI regression cases cover both supported ABIs, missing RELRO, unaligned LOAD/RELRO and archives without supported native libraries. Controlled readelf fixtures test gate behavior, not runtime compatibility. All five tests pass; all six previously aligned dependency binaries still pass the stricter checker (`/tmp/ujimora-dependency-page-strict-elf.json`).

An isolated React Native0.83.10 composite source-build candidate substitutes ReactAndroid and Hermes in the archived native checkout only. Dependency resolution succeeded, and build90233 is still live, now building Hermes/native dependencies (`/tmp/ujimora-react-native-source-build.log`). No repository dependency substitution, source patch or prebuilt gate closure is claimed. Full API41412 also remains live on unchanged de8b9e2; retain root API/shared source freeze.


### Included-build flag propagation — 13 September 2026

The initial React Native source candidate completed Hermes on both64-bit ABIs. Actual libhermesvm.so inspection fails RELRO with remainder0x2000 on ARM64 and0x3000 on x86_64 despite16KB LOAD alignment. Evidence `/tmp/ujimora-hermes-source-both-elf.json`, archiveSHA25685ab516c226a85c7fec6d277b43dc2dd112aa50db6cdd64baa4e243660a61fd4. The inspection archive is not an installable release. ReactAndroid and Hermes CMake caches show empty shared linker flags: app-root project callbacks do not configure the separate included build.

After obtaining these completed Hermes outputs and confirming the configuration defect, intentionally stopped experimental build90233 with SIGINT; its handle returned terminal exit130. This was a configuration correction, not a timeout restart. Started candidate70084 with the same archived source/NDK28.2/JDK17 and an explicit Gradle init script. Both generated Hermes caches at .cxx/MinSizeRel/205hh6s1 now contain max-page-size=16384 and common-page-size=16384. Compilation remains live; no resulting ELF or release pass is claimed yet.

Init recipe: `gradle.beforeProject { p -> p.pluginManager.withPlugin("com.android.library") { p.android.defaultConfig.externalNativeBuild.cmake.arguments.add("-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384") } }`. Passed via `--init-script /tmp/ujimora-native-source-alignment.init.gradle` to `:app:externalNativeBuildRelease`, with `-PreactNativeArchitectures=arm64-v8a,x86_64 -PndkVersion=28.2.13676358`. Log `/tmp/ujimora-react-native-aligned-source-build.log`. No package dependency selection or runtime substitution has been committed. Prebuilt C++/fbjni copies and other media dependencies remain separate gates.


### Both Hermes source candidates aligned — 13 September 2026

Corrected included-build candidate70084 completed libhermesvm.so for ARM64 and x86_64. Both pass16KB LOAD and required RELRO presence/end checks with zero end remainders. Each preserves all71 defined dynamic symbol names from its initial unaligned source build; this is symbol-presence evidence, not full ABI/runtime proof. Logs `/tmp/ujimora-hermes-both-aligned-elf.json` and `/tmp/ujimora-hermes-both-aligned-symbols.json`; archive `/tmp/ujimora-hermes-both-aligned.aar` is inspection-only. ReactAndroid compilation remains live in70084; no final APK/AAB or integrated device pass.

Runtime provenance investigation: installed NDK28.2 clang_source_info.md pins LLVM base3b5e7c83a6e226d5bd7ed2e9b67449b64812074c plus51 Android patches at llvm_android commit e727bfb014bd436f581a66a450c939a6983a1fc3. Retrieved upstream libcxx/libcxxabi/runtimes/cmake/llvm-cmake subtrees into `/tmp/ujimora-ndk28-runtime-source`, and the pinned DeviceLibcxxBuilder recipe into `/tmp/ujimora-ndk28-builders.py`. Its NDK variant uses ABI version1, namespace __ndk1, statically linked ABI within the shared library and c++_shared output naming.

Patch acquisition31107 completed but only41 of51 references succeeded: two404s and eight503s. Full manifest `/tmp/ujimora-ndk28-runtime-patches/manifest.json`; no patches applied and no runtime build or substitution performed. Missing patch provenance must be reconciled before claiming a matching Android runtime. The current public Android LLVM BUILD.md also marks external rebuild instructions pending updates; a generic upstream build must not be described as an exact NDK reproduction. Source: https://android.googlesource.com/toolchain/llvm_android/+/main/BUILD.md (checked13September2026).


### ARM64 React Native and C++ runtime candidates — 13 September 2026

All51 NDK patch references are now fetched. The two404 references omitted the cherry/ directory; the same pinned PATCHES.json supplies their actual paths. Transient503 retries succeeded. Original/resolved URLs remain in `/tmp/ujimora-ndk28-runtime-patches/manifest.json`. All10 patches touching the retrieved runtime/CMake source subset applied cleanly in listed order, with hashes and paths recorded in `/tmp/ujimora-ndk28-runtime-applied.json`. No compiler-source patches were applied to absent compiler subtrees; the compiler remains the installed NDK28.2 binary.

The isolated ARM64 libc++ candidate configures/builds successfully for Android API24 with the pinned runtime ABI settings, HAS_THREAD_LOCAL, -nostdlib++, -unwindlib=libunwind and both16KB linker flags. Initial configure6222 failed because the partial checkout lacked llvm/utils/llvm-lit; fetched llvm-lit/lit from the same base revision, and corrected configure plus build43651 finished exit0. Candidate tests/benchmarks were not built; this is a library build, not upstream runtime test acceptance. It is not claimed byte-identical to the distributed NDK runtime.

The rebuilt libc++_shared.so and completed ARM64 ReactAndroid libjsi.so/libhermestooling.so/libreactnative.so all pass required LOAD/RELRO checks. `/tmp/ujimora-rn-runtime-arm64-aligned-elf.json` covers precisely these four binaries. Runtime dynamic exports:2,339 versus2,340 in NDK28.2; only __llvm_fs_discriminator__ (compiler profiling marker) is absent, with no added names (`/tmp/ujimora-libcxx-arm64-symbols.json`). This does not establish complete ABI, unwind, exceptions, threading or device compatibility. Existing app/prebuilt runtime copies remain untouched.

ARM64 runtime source/output `/tmp/ujimora-ndk28-runtime-source` and `/tmp/ujimora-libcxx-aligned/arm64-v8a`; configure/build logs `/tmp/ujimora-libcxx-arm64-{configure-final,build}.log`. Started x86_64 candidate27955 with the same settings; exact argument vector `/tmp/ujimora-libcxx-x86-configure-args.json`, logs `/tmp/ujimora-libcxx-x86-{configure,build}.log`. It remains live, as does React Native build70084. Final packaged provenance, duplicate elimination, both-ABI integration and device/runtime suites remain open.


### Both-ABI runtime alignment and ARM64 device probe — 13 September 2026

C++ x86_64 build27955 finished exit0. Its libc++_shared.so and completed x86_64 ReactAndroid libjsi.so/libhermestooling.so/libreactnative.so all pass LOAD/RELRO checks (`/tmp/ujimora-rn-runtime-x86-aligned-elf.json`). Runtime dynamic exports:2,333 versus2,334 in the NDK original, again missing only __llvm_fs_discriminator__ with no added names (`/tmp/ujimora-libcxx-x86-symbols.json`). Both-ABI source candidate alignment is now established for these runtimes and RN/Hermes libraries; app integration is not.

Added reproducible `scripts/compliance/native-runtime-probe/` C++ shared-library/executable and Python runner. On dedicated emulator-5580, getconf PAGE_SIZE=16384; compatibility properties read false for bionic.linker.16kb.app_compat.enabled and true for pm.16kb.app_compat.disabled. The probe maps the rebuilt ARM64 candidate at its explicit device path and passes32 load/unload cycles with256 cross-library string allocation/deletion operations, exception catches and thread-local destructors. Candidate runtime SHA256 is recorded in `/tmp/ujimora-rn-runtime-arm64-aligned-elf.json`. Both the original invocation and committed-script invocation12308 return0. Logs `/tmp/ujimora-runtime-probe-device.log`, `/tmp/ujimora-runtime-probe-script.log`.

The probe writes only its three files under /data/local/tmp/ujimora-runtime-probe on the explicitly selected test emulator. It does not modify Ujimora installations or account data. Scope excludes x86_64 runtime execution, full ABI/upstream C++ suites, unloading with live workers, JNI/media, physical devices and packaged app startup. React Native build70084 remains live in dependency native tasks. No runtime or prebuilt substitution has been integrated in the app, and signed/store release gates remain open.


### Native build complete; APK candidate packaging — 13 September 2026

Corrected native build70084 completed exit0 in11m9s (163tasks,45executed). This verifies the archived native source build with included ReactAndroid/Hermes and both linker flags; it does not itself produce a complete APK.

Copied the four independently inspected C++/fbjni candidate binaries into the isolated archived app's src/main/jniLibs/{arm64-v8a,x86_64}. Explicit pickFirsts patterns cover only libc++_shared.so and libfbjni.so. All four merged native files match the candidate SHA256 values exactly (`/tmp/ujimora-candidate-merged-provenance.json`); final stripped APK provenance still needs inspection. No project/dependency source or candidate binary was added to the production app configuration.

APK assemble24833 finished exit1 after1m56s: Android lint workers exhausted Metaspace while analyzing ReactAndroid, expo-constants and LiveKit WebRTC. This is not an ignored lint pass. Restarted after terminal failure as35851 with4GB Java heap,2GB metaspace, max-workers2 and a single-use daemon; lint stays enabled. Log `/tmp/ujimora-aligned-candidate-apk-retry.log`. Uses archived69d94fa JS, debug signing and deliberately non-routable https://api.invalid; never a final current-source/provider/store release.

Cached AAR inventory maps remaining original failing prebuilt names to AndroidX graphics-path1.0.1/datastore-core-android1.1.7, Fresco3.6.0, gif3.0.5, avif1.1.1.14d8e3c4, WebRTC144.7559.05 and LiveKit noise2.0.0 (`/tmp/ujimora-remaining-native-owners.json`). This identifies candidate dependency owners, not proof of final selected/packaged versions or remediation. Re-inspect the actual new APK before closing any packaged-library finding.


### Candidate APK assembly completed — 13 September 2026

Retry35851 completed exit0 in1m37s (1,085tasks,87executed), with lint enabled. APK `/tmp/ujimora-android-69d94fa/android/app/build/outputs/apk/release/app-release.apk`. Actual ELF inspection63780 covers4864-bit libraries: 30pass LOAD/RELRO, the remainder fail; report `/tmp/ujimora-aligned-candidate-apk-elf.json`. This is archived69d94fa JavaScript/debug signing/non-routable API, not a release approved artifact. Final stripped-binary provenance, ZIP alignment, startup and remaining third-party library fixes are still required.


### Candidate packaged runtime provenance — 13 September 2026

Candidate APK passes build-tools36.0.0 zipalign -c -P16 4 (exit0). Stripping each verified libc++/fbjni candidate with NDK28 llvm-strip --strip-unneeded yields exact SHA256 matches to all four packaged entries on ARM64/x86_64 (`/tmp/ujimora-candidate-apk-provenance.json`). Emulator installation67508 completed exit0/Success. New APK startup is not yet verified;18 other packaged libraries still fail ELF alignment. No final current-source or store/device acceptance is inferred.


### Packaged candidate starts on16KB; DataStore evaluation — 13 September 2026

The installed candidate APK cold-started successfully on emulator-5580: am start Status:ok, TotalTime597ms, process6933; ReactNativeJS logs Running main and MainActivity is topResumedActivity. Screenshot `/tmp/ujimora-candidate-startup.png` visibly renders the campaign-load error/Retry and navigation expected from https://api.invalid. No fatal exception appears in the observed PID log. Readback confirms16384-byte pages, bionic compatibility false and package compatibility-disabled true. Logs `/tmp/ujimora-candidate-{startup,startup-logcat,activities,maps}.log`. This verifies candidate native/JS startup only, not production connectivity, all media/runtime paths, physical devices, x86_64 execution or store acceptance.

Primary repository metadata identifies stable DataStore1.2.1; both64-bit native entries in its actual AAR pass LOAD/RELRO. New graphics-path1.1.0 and Fresco imagepipeline-native3.7.0 AARs still fail RELRO on both ABIs (remainder0x2000), so no version-only acceptance. Evidence `/tmp/ujimora-native-{datastore-1.2.1,graphics-1.1.0,fresco-imagepipeline-3.7.0}-elf.json`. AndroidX release page confirms1.2.1 stable: https://developer.android.com/jetpack/androidx/releases/datastore (checked13September2026).

Started isolated DataStore APK candidate33497, aligning the androidx.datastore family to1.2.1 through `/tmp/ujimora-datastore-candidate.init.gradle` in addition to prior native/runtime build settings. Log `/tmp/ujimora-datastore-candidate-build.log`; currently live. Production mobile configuration has not changed. Final dependency compatibility, packaged hashes, preference/storage behavior and remaining native findings require verification before promotion.
