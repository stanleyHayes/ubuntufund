# Push and unsupported notification channels

Audit, 2026-09-12. Device/browser push and SMS delivery are unavailable in this release candidate.

The old native Settings control requested operating-system permission and registered an Expo token, but no push sender existed. Turning the profile flag off also left that token enabled. The web control advertised browser push without a subscription/delivery implementation. SMS and campaign-announcement controls similarly stored flags without a corresponding delivery service.

Web/native Settings now explain the unavailable channels and retain the working default-off activity inbox/email preferences and separate newsletter consent. The native Settings screen no longer calls the device-permission/token-registration helper. Authenticated new push registration returns 503 without storing a token. Unregister remains available for older clients and scopes withdrawal to the current account. Account erasure removes retained push tokens. Existing profile flags are not evidence of consent for a future service.

Before enabling push, implement purpose-specific explicit consent, OS permission requested in context, durable delivery with current consent/account checks, withdrawal that disables device registrations, logout/shared-device reassignment, token invalidation, provider receipt handling and physical-device verification. Promotional push needs its own disclosed opt-in; email/newsletter permission must not authorize it. Review retention/removal of legacy tokens and update store privacy declarations. The dormant SDK/helper is not proof of a working delivery service.

[Apple App Review Guidelines 4.5.4](https://developer.apple.com/app-store/review/guidelines/) require explicit opt-in and an in-app opt-out for promotional push. [Android permission guidance](https://developer.android.com/training/permissions/requesting) calls for requesting runtime permissions in context. The current choice avoids requesting permission or collecting identifiers for an unavailable service.

Two API tests pass for unavailable registration without persistence, authenticated access and withdrawal of a legacy token. API/web/native type and lint checks pass. The phone newsletter/Settings browser regression also passes after the unavailable-channel changes.
