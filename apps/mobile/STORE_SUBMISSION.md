# Ujimora store submission checklist

Updated 13 September 2026. **Not approved for release.** Repository implementation
is separate from signed-device evidence, legal authorization and store-console
acceptance. The requirement ledger is [READINESS](../../docs/compliance/READINESS.md).

## Repository implementation

- [x] Production account authentication has no demo-token bypass; configured API origins require HTTPS.
- [x] Settings initiates authenticated account closure. Current sessions are revoked; financial IDs remain, with retryable personal-data erasure and residual processor review. See [data rights](../../docs/compliance/DATA_RIGHTS.md).
- [x] Public Privacy, Terms and account-deletion instructions are available without signing in. Versioned agreement and adult-age confirmation are enforced for account/publication flows.
- [x] Optional authenticator MFA has post-login setup, QR/manual key, OTP sign-in and copy/save recovery codes. Verify real authenticator scanning and recovery saves on devices; optional biometric session protection is implemented with protected credential reads and a private-screen lock. Verify biometric behavior and app-switcher privacy on supported physical devices. See [account protection](../../docs/compliance/MFA_AND_BIOMETRICS.md).
- [x] Access/refresh tokens use SecureStore. Legacy AsyncStorage credentials migrate and are removed.
- [x] Optional activity alerts and emails default off by category/channel. Push enrollment is disabled and its unsupported Settings switch removed; existing tokens can be invalidated. A registered notification handler is not evidence of working push delivery.
- [x] Native subscriptions use Expo IAP and server verification, restore, ownership checks and durable recovery. See [store billing](../../docs/compliance/STORE_BILLING.md).
- [x] iOS campaign donations open the external browser before payment entry. Native creator tipping is unavailable pending an approved payment model. See [fundraising](../../docs/compliance/FUNDRAISING.md).
- [x] Report/block controls and private staff review cover implemented community surfaces; AI generation has screening, explicit transmission consent and an in-app report action. Broader preventive moderation remains open in the readiness ledger.
- [x] App configuration declares UserDefaults access for preferences and no tracking, blocks broad media/read-storage and background-location/overlay permissions, and supplies camera/microphone/location purpose strings. Legacy write storage remains for the installed picker's pre-Android-10 camera dependency. See [generated permission audit](../../docs/compliance/NATIVE_PERMISSIONS.md); this does not verify the final merged manifest, every linked SDK or production data handling.
- [x] Bundle/package identifiers and build metadata are configured.
- [ ] Resolve every remaining engineering gate in the readiness ledger before submission.
- [x] Expo Doctor passes 20/20 against the current checkout on 13 September 2026; log `/tmp/ujimora-compliance-expo-doctor.log`. Fresh iOS/Android/web JavaScript exports also pass; see the readiness ledger.
- [ ] Verify final locked dependencies with an isolated clean install and complete release checks after all engineering changes. Doctor and JavaScript export do not verify signed native libraries or production services.
- [ ] Produce signed EAS/store artifacts from the final commit; verify Android API 36/16 KB libraries and merged permissions, and inspect the final iOS privacy report and SDK signatures.
- [ ] Test installation, cold launch, signup, KYC, consent withdrawal, report/block, external donation return, store purchase/restore, deletion and deep links on physical supported devices.
- [ ] Verify VoiceOver/TalkBack, text scaling, reduced motion, keyboard avoidance, safe areas and iPad layouts.

## Store and operator evidence

- [ ] Confirm the legal seller/operator, parent-company relationship, supported countries, required Ghana registrations and payment/crowdfunding permissions.
- [ ] Configure final HTTPS API, payment providers, email sender/keys, store catalog/notifications, processor contracts and operational review queues.
- [ ] Verify final domains, public Privacy/Support/deletion URLs and universal/app links. Custom scheme configuration alone does not prove domain association.
- [ ] Complete Apple App Privacy and Google Data safety using [the data inventory](../../docs/compliance/STORE_DATA_INVENTORY.md), actual processor terms and final binary/network evidence.
- [ ] Complete financial features, account-deletion, encryption/export, age-rating, content rights, territories and business verification declarations.
- [ ] Configure and test actual App Store/Google Play products, purchase notifications and sandbox review accounts. Repository tests use doubles and cannot certify store acceptance.
- [ ] Provide accurate screenshots and a working non-admin reviewer account; explain KYC, campaign approval, moderation, external fundraising, subscriptions, refunds and deletion.
- [ ] Confirm no placeholder content, test payment configuration, unavailable required backend or unfulfilled deletion/rights process remains.

Account closure preserves relational and financial integrity; it is not an excuse
to retain personal data indefinitely. Retention schedules, lawful exceptions,
processor erasure and outstanding legal holds require documented operator review.

### Android screen-sharing foreground service

- [ ] Declare the media-projection foreground-service use in Play Console with the actual user-initiated live screen-sharing flow and requested review evidence. See [Google foreground-service requirements](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).
- [ ] On a signed Android 14+ device build, verify capture consent, denial without capture, app/window selection, visible service notification, stop/disconnect, system revocation and repeated sessions. Also verify microphone behavior when leaving the app during sharing.
- Source configuration explicitly declares FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PROJECTION for the existing WebRTC mediaProjection service. A declaration is not a runtime or store-console verification.
