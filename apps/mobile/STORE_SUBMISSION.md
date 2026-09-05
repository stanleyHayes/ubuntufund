# Ujimora store submission checklist

This file separates repository readiness from App Store Connect owner actions.
Do not submit until every unchecked item has current evidence.

## Repository gates

- [x] Account creation and login use the production API; no demo-token bypass remains.
- [x] Account deletion is available in Settings and calls authenticated `DELETE /profile`.
- [x] Deleted accounts are soft-deleted from active product views and existing tokens are revoked.
- [x] Privacy and Terms screens are reachable without authentication.
- [x] iOS privacy manifest declares UserDefaults access for app preferences and sets tracking to false.
- [x] Access and refresh tokens use Keychain/Keystore-backed SecureStore; legacy AsyncStorage tokens migrate once and are removed.
- [x] Notification permission is requested only after the user explicitly enables Push Notifications in Settings.
- [x] Push device tokens register through authenticated API storage and unregister by soft invalidation.
- [x] Production API configuration requires HTTPS through `EXPO_PUBLIC_API_URL`.
- [x] iOS bundle identifier and build number are present.
- [x] `npx expo-doctor` passes against the locked dependency tree (19/19 on 2026-08-09).
- [ ] Production EAS build completes on a clean checkout.
- [ ] TestFlight install, cold launch, sign-up, donation, account deletion, and deep-link smoke tests pass on a physical iPhone and iPad.
- [ ] VoiceOver, Dynamic Type, reduced motion, keyboard avoidance, safe areas, and landscape/tablet layouts are manually verified.

## App Store Connect owner gates

- [ ] Confirm the final product name, bundle identifier, universal-link domain, and support email before the first production build.
- [ ] Configure `EXPO_PUBLIC_API_URL` in the EAS production environment with the final HTTPS API origin.
- [ ] Add iOS associated domains, Android App Links, and hosted AASA/assetlinks files only after the final domain is controlled and verified.
- [ ] Supply a public Privacy Policy URL and Support URL on the final verified domain.
- [ ] Complete App Privacy answers from the production data inventory, including identity, contact, payment, user-content, diagnostics, and push-token handling.
- [ ] Complete age rating, content rights, encryption, and financial-services declarations accurately.
- [ ] Upload screenshots for every currently required iPhone/iPad display class using real production-like content.
- [ ] Provide App Review with a live non-admin review account and explain campaign creation, KYC, payments, refunds, subscriptions, and account deletion in Review Notes.
- [ ] Verify no placeholder, test payment, dead link, empty required content, or unavailable backend remains in the submitted binary.
- [ ] If paid digital subscriptions are offered in the iOS app, complete StoreKit/In-App Purchase integration or obtain an applicable guideline exception before submission.
- [ ] Ensure the seller is the legal entity operating the financial/crowdfunding service and attach any requested authorization or regulatory documentation.

## Account deletion behavior

Settings contains the deletion control. The API immediately soft-deletes the user from active product views and revokes outstanding sessions. Transaction, fraud-prevention, safety, and dispute records may be retained only where legally required; the public privacy policy must describe the retention period and deletion process.
