# Store data inventory — 12 September 2026

Status: source-reviewed draft for C17. Do not copy this table into either store
console as approved answers. Final answers require the release binary, provider
configuration/contracts, network inspection and operator confirmation.

Apple requires declarations covering the app and integrated partners, including
collection for functionality, and treats its optional-disclosure exception
narrowly. [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
Google's collection/sharing and purpose definitions must be applied separately;
a service-provider relationship cannot be assumed just because a vendor is used.
[Google Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469)

## Data flows found in this repository

| Flow / evidence | Data and recipient | Purpose and user choice | Declaration / verification work |
| --- | --- | --- | --- |
| Signup/profile; `app/(auth)/register.tsx`, API user/profile models | Name, email, account ID, optional phone/address and organization details; API/database | Account operation; required identity fields and optional profile fields differ | Contact information, identifiers and other personal information; linked to account. Review public/private fields. |
| Organization website request; `WebsiteRequestNotice`, signup | Organization contact/profile and explicit website request; operator, intended Neurodyne Corp Ltd contact | Separate unchecked opt-in, server-dated consent and withdrawal | Marketing/contact purpose in addition to functionality where applicable. Confirm parent-company identity, recipient access and downstream withdrawal before real outreach. |
| KYC; `app/kyc.tsx`, `MediaUploadField`, private upload API | Identity/business documents, address and verification evidence; API, authenticated Cloudinary storage, authorized staff | Verification; selected document/camera upload. Optional foreground location fills address; manual entry available | Personal information, photos/files and potentially sensitive information. GPS coordinates are passed to OS reverse geocoding; submitted draft uses address fields. Inspect OS/provider processing before deciding precise-location disclosure. |
| Campaign/profile media, stories, updates and discussions | Text, photos and selected files; API/storage and intended public viewers | Publication and community features | User content may include third-party health or other sensitive details; don't classify all content as nonsensitive. Review author consent, visibility and moderation. |
| Donations, wallet and payout accounts | Amounts, currency, references, account/user IDs, recipient/bank/MoMo details, donor message; API and configured payment providers | Financial functionality; optional public message/anonymity | Financial information/purchase history and identifiers. A public anonymous donation still has private processing records. External card entry does not remove disclosure duties for financial data the API receives. |
| Native store subscriptions; `src/lib/storeBilling.ts`, billing API | Store transaction/receipt or purchase token, product, account linkage, entitlement; Apple/Google and API | Purchase verification, restore and fraud prevention | Purchase history and identifiers, linked to account. Server-only encrypted evidence is still collected data. Verify actual SDK and store traffic. |
| Live broadcast; LiveKit/WebRTC components | Live audio/video/screen share, participant identity, connection/network metadata; configured LiveKit service and viewers | User-initiated live communication | Audio/video/user content and possible diagnostics/identifiers. Confirm recording, logs, retention and subprocessors from the configured service; do not assume transient processing qualifies for omission. |
| AI writing; assistant, `OpenAiWritingProvider`, `OpenAiContentModerator` | Chosen text/instructions and generated text for screening; OpenAI through API. Usage quota/fingerprint stored locally | Separate permission for each transmission; optional writing feature and safety screening | User content and interaction/identifier data. `store: false` on generation is not a zero-retention contractual guarantee. Provider retention/transfer terms remain required. |
| Safety reports, appeals and data-rights cases | Reporter account, explanation, private snapshots and submitted evidence, staff response/audit; API and authorized staff | Safety, complaints and rights fulfilment | User content, customer support and identifiers; explicit AI reports store original generated evidence. Confirm retention/holds and controlled fulfilment. |
| Activity and account email; `ResendActivityEmails`, account-email services | Address, necessary event/security message and delivery metadata; Resend | Activity categories/email default off; essential requested recovery/verification is separate | Contact information and service communication. Marketing is not implied by a donation or a recovery request. Verify dedicated encryption keys, sender and actual delivery. |
| Newsletter; newsletter API/settings | Email, confirmation/consent timestamps and subscription status; API/email processor | Separate double-confirmed opt-in and revocable subscription | Contact information and marketing purpose. No working bulk campaign sender is claimed. |
| Local storage; `src/lib/session.ts`, payments, appearance | SecureStore credentials; AsyncStorage user summary, preferences and pending payment references | Session continuity, appearance and return recovery | Local-only storage is distinct from server collection. Verify logout/deletion cleanup of all user-scoped remnants on device and backup behavior. |
| Push; `src/services/notifications.ts` | SDK/handler remains installed; registration helpers currently have no active enrollment caller; API rejects new enrollment | No current user-facing push subscription; legacy unregister remains | Do not claim working push enrollment. Inspect final SDK traffic and retained legacy tokens before answering “not collected.” See `PUSH_NOTIFICATIONS.md`. |
| Runtime/build and hosting | Expo/React Native, OTA package, platform SDKs; API/host logs | Application delivery and diagnostics | `expo-updates` is installed, with no update endpoint in checked app configuration. Final EAS configuration, CDN, server IP/request logs and crash/network telemetry still need verification. No advertising SDK was identified in the reviewed direct dependency list; this is not proof of no tracking by any processor. |

## Required release evidence

### Native payment request storage — 13 September 2026

Payment idempotency lookup keys previously embedded JSON checkout input, including optional contact details and messages, in AsyncStorage key names. New keys use a SHA-256 digest of that input. When a matching legacy request is retried, the existing idempotency UUID is saved under the digest key before the plaintext key is removed; failed persistence keeps the original attempt available. Explicit completed-payment cleanup still removes the scope's records. Hashes are not encryption or anonymous data: user/target scope identifiers remain, and pending provider checkout references/URLs still need their own storage and lifecycle review. Untouched historical request keys are not claimed erased by this migration-on-use change.

Malformed native pending-payment records now produce a visible recovery error rather than being treated as absent. Checkout revalidates the saved record before generating an idempotency key or calling the API, retaining unreadable or cross-scope data for investigation. Six malformed-record tests prove that no network payment call or storage replacement occurs. This does not resolve historical plaintext cleanup or device backup evidence.

The mobile payment suite checks private-field absence, repeat/concurrent retry identity, migration, failed-storage recovery and provider pending/confirmed distinctions. Platform JavaScript exports cover iOS, Android and web; signed-device storage/backup inspection remains open. See the execution ledger for final test counts and current full API regression status.

1. Freeze the commit/lockfile and enumerate direct and transitive SDKs in the
   signed artifact, including privacy manifests, required-reason APIs and SDK
   signatures. Keep a dated artifact inventory with versions and owners.
2. Inspect network behavior for fresh install, denied permissions, signed-out
   browsing, each optional feature and withdrawal/deletion. Record endpoint,
   data categories, purpose and retention without retaining test credentials or
   real personal data in evidence.
3. Obtain processor/subprocessor, hosting region, security, deletion and transfer
   terms for the configured deployment. Confirm whether each transfer qualifies
   as sharing under the relevant store definition.
4. Map each collected category to each store's exact current terms, whether linked
   to identity, required/optional, encrypted in transit, purpose and retention.
   Optional consent does not automatically make disclosure optional.
5. Reconcile public Privacy Notice, in-app disclosures, permission prompts and
   console answers; obtain owner sign-off and retain the submitted answers and
   release reference. Update when any processor or feature changes.

This inventory does not certify Ghana registration, lawful basis, international
transfer safeguards, store compliance or operational erasure. Those remain in
`READINESS.md` and the feature-specific evidence documents.

### Picker upload cache cleanup — 13 September 2026

Native `MediaUploadField` now attempts cleanup in its upload `finally` block, including failed uploads and size rejection. `discardUploadCache` removes only an existing local file beneath the app cache directory; remote/content-provider URLs, source documents outside cache, prefix collisions and traversal paths are preserved. It never deletes the server upload or a user-selected saved copy. A cleanup failure is visible without replacing an earlier upload error. No bulk purge of historical files is implied.

All 101 native tests, final types/lint pass; new tests exercise cache-only deletion, already-removed files, source/traversal preservation and deletion failure. Logs `/tmp/ujimora-upload-cache-{tests,types-final,lint-final}.log`. Physical camera/document-provider behavior and residual historical-cache cleanup remain release checks. The Android manifest run uses the earlier isolated mobile copy and does not validate this new component change.
