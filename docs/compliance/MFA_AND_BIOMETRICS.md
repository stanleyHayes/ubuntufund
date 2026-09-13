# Optional account protection

Status on 12 September 2026: authenticator MFA and native biometric session protection implemented; simulator build and runtime verification pass; physical-device verification remains open. Compliance and the final main commit/push remain active requirements.

## Authenticator MFA

MFA is off by default. An authenticated member, organization or administrator can start enrollment from account settings, re-enter the password, scan the Ujimora QR code (or copy its setup key) and confirm a six-digit code. Starting or cancelling setup does not enable MFA. Pending setup expires after ten minutes and the database TTL removes it. A replacement enrollment invalidates the earlier setup identifier.

Web, admin and native sign-in submit the password plus an authenticator or recovery code when required. No login access/refresh token is issued before the factor succeeds. Web/admin and native inputs have one box per digit and support pasting/autofill. Setup is available in member Settings, admin Profile and native Settings.

The implementation uses HMAC-SHA1 TOTP with six digits, 30-second steps and one adjacent step of clock tolerance. A persisted last-used counter rejects reuse, including concurrent requests on separate API instances. Recovery codes contain 128 random bits each, are stored only as SHA-256 hashes and are atomically consumed once. Ten codes are returned on successful enrollment/replacement. They can be copied or downloaded and are not returned by status reads. Native saves use the device save/share sheet and delete the temporary plaintext file afterward, including on errors; the user-selected saved copy remains under the user's control.

Settings changes require the current password; disable/replacement additionally require a current factor. Factor consumption, the security change, credential-version rotation and audit record commit in one database transaction. Failure rolls back the change and factor consumption. MFA changes revoke earlier access and refresh sessions; the initiating client adopts the new tokens only if it still belongs to the same account. General profile updates cannot restore a previous credential version. Account erasure removes the MFA record, without deleting financial references.

A durable account-level counter allows ten factor attempts per ten-minute window across API instances, in addition to the existing IP limiter. Secrets use AES-256-GCM encryption bound to the user ID; no secret, QR payload, OTP or recovery code is included in the audit details. Auth/MFA responses are private/no-store.

## Configuration and compatibility

- Set `MFA_ENCRYPTION_KEY` to a dedicated random 32-byte key encoded as base64. It is separate from JWT keys. Back it up securely and keep it stable across instances/restarts; changing it does not migrate existing secrets. Do not deploy an ephemeral or per-instance key.
- Blank/invalid configuration disables new enrollment and prevents TOTP verification for existing enrollments. It never downgrades them to password-only sign-in. A valid unused recovery code remains usable, so an account can disable/re-enroll after configuration recovery. Losing both the encryption key and all recovery methods requires a separately controlled recovery process; no bypass endpoint was added.
- QR codes are generated locally by the API, not sent to an external QR service. The URI uses the `Ujimora` issuer/account label and supplies the configured public web origin's favicon as an optional `image` hint. The setup screen itself shows the Ujimora logo. Authenticator support for a custom icon varies; universal icon rendering is not guaranteed by the key-URI format.
- Production must serve the configured `PUBLIC_WEB_URL` and favicon over HTTPS and keep server clocks synchronized. Verify actual scanning with supported authenticator apps on devices. No production keys, real user enrollment, store submission or external message was created for these checks.

Protocol references checked: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), [Google Authenticator key URI format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format), [Expo SDK 55 sharing](https://docs.expo.dev/versions/v55.0.0/sdk/sharing/) and [file system](https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/).

## Verification

- 13 API tests across MFA, RFC primitive vectors and existing auth: opt-in enrollment, authentication requirement, secret encryption/account binding, QR fields, session revocation, absent/invalid/reused factors, concurrent TOTP/recovery use, replacement/disable, expired/cross-account setup, transaction rollback, durable limits and missing-key recovery.
- Three shared web component tests cover OTP paste/backspace, explicit enable confirmation, failed-code preservation and recovery copy controls. Full web/admin suites pass 132/39 tests.
- Native suite passes 47 tests, including exact recovery-file contents and cleanup after success/failure. Native component device interaction is not proven by these logic tests.
- Four-app type checks and lint pass. Web/admin production builds and native iOS/Android/web JavaScript export pass; existing build chunk-size advisories remain.
- Two phone browser tests pass: setup, branded QR, confirmation, exact clipboard content, actual downloaded-file contents and the sign-in factor gate with no session issued after a rejected factor. Final setup/recovery screenshots were visually inspected at 390px; there is no horizontal overflow.

## Native biometric session protection

iOS/Android Settings detects enrolled hardware and SecureStore biometric capability. The option starts off. Enabling requires device confirmation, saves only the account ID and refresh credential in a separate biometric-protected keychain/keystore service, then removes the ordinary saved access/refresh tokens. The app never receives fingerprint or face templates. Initial iOS enrollment explicitly prompts because creation of a new keychain item does not itself require authentication; subsequent protected reads/updates use SecureStore's biometric access control. Android requires strong biometric capability for the cryptographic operation.

Cold start reads the protected-mode preference before attempting ordinary or legacy credential loading, clears leftover ordinary credentials and displays a lock screen. Backgrounding clears the in-memory session and fences outstanding refresh/unlock work. Private screen descendants are unmounted when locked; the hidden navigator stays mounted so unlocking cannot replay a stale launch deep link. During the operating-system prompt's temporary inactive state, the mounted screen is hidden from display/accessibility to preserve forms and newly shown recovery codes; a genuine background transition still invalidates the pending unlock. The tests distinguish these two cases.

Unlock requires an explicit protected credential read and successful server refresh before restoring the session. Cancellation, changed enrollment, missing credentials, network failure or revoked/expired refresh tokens cannot restore access. A user can choose password/MFA sign-in instead, which removes the old device vault and preference. Unlock itself does not disable account MFA or extend the stored credential's original server expiry. Normal in-session renewals stay in memory to avoid repeated biometric prompts; the saved biometric refresh credential remains limited by its original expiry. Password/MFA credential rotation replaces the protected credential using a new authenticated write. Failed local saving cannot silently write it to ordinary storage.

Turning biometrics off requires an authenticated vault read. Sign-out clears the protected vault and preference. Account changes do not inherit another account's biometric setting. This is native biometric unlock, not browser WebAuthn/passkey enrollment.

The Face ID purpose string is configured for both LocalAuthentication and SecureStore. Native dependencies are SDK 55 compatible. The shared privacy notice discloses optional MFA and local biometric protection.

Verification: the native suite passes **59 tests**, including protected credential lifecycle, 15-second unlock timeout, idle locking and privacy-cover rendering/accessibility checks. They cover cancellation, unavailable/changed hardware, storage options, migration, cold start, logout during a prompt, concurrent unlock, background during unlock/refresh, credential rotation and disable confirmation. A navigation regression confirms that actual locks remove private screens while preserving the navigator. Native types/lint and final iOS/Android/web JavaScript export pass. CocoaPods installation and both unsigned and ad-hoc signed iOS simulator builds pass. The unsigned launch lacked Keychain entitlements; the ad-hoc signed build resolves this and is the runtime evidence.

The isolated test API and iOS 26.5 simulator walkthrough verified ordinary sign-in, Face ID initially off, explicit opt-in with a simulated matching face, enabled Settings, manual lock, server-backed unlock returning to Settings, background/resume locking and password fallback returning to the unauthenticated gate. A runtime navigation issue found during this check was corrected and retested. Protected reads do not prompt on the simulator; hardware authentication is therefore not claimed. No production API account, external email or provider transaction was used.

Physical-device release gates remain: Face ID/Touch ID and supported Android hardware, OS enrollment changes, background/app-switcher cover timing, accessibility, password/MFA fallback and keychain/keystore behavior. Simulator results cannot prove actual hardware-backed access control; Expo explicitly notes this distinction. No signed store artifact or physical-device biometric verification is claimed.

Official platform references: [Expo SDK 55 LocalAuthentication](https://docs.expo.dev/versions/v55.0.0/sdk/local-authentication/) and [SecureStore](https://docs.expo.dev/versions/v55.0.0/sdk/securestore/).
