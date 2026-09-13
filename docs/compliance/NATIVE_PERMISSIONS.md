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
