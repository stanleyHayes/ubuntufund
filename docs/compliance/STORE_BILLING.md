# Native subscription billing implementation

Status on 12 September 2026: **ENGINEERING IMPLEMENTED; release configuration and store verification pending**. C10 remains IN PROGRESS.

Digital plans use Expo IAP on iOS/Android. The web variant retains Paystack. Native code has no external digital checkout fallback. Fundraising is a separate requirement (C11).

## Implemented behavior

Native build checkpoint: isolated `pod install` and unsigned Debug iOS Simulator `xcodebuild` both succeeded using Xcode 26.6. This proves native dependency compilation, including Expo IAP/OpenIAP; it does not prove signed-device purchases, store acceptance or current native UI behavior. The latest activity-notification JavaScript export passes separately.

- The server owns the product/base-plan to tier/cycle mapping. Native prices and renewal periods come from store products, not web pricing. Only supported monthly/yearly auto-renewing products are offered; prepaid, installment, family-shared and multi-phase offers are not supported.
- A durable random account UUID binds Apple appAccountToken and Google obfuscatedAccountId. Original transactions/purchase tokens have a unique owner. Deleted or mismatched accounts cannot restore a purchase to another account.
- Apple's official server library verifies signed current transaction/renewal state, certificate trust, app identity, environment and account binding. Google subscriptions V2 verifies package, base plan, account binding and current state. Old receipts and notifications are lookup references, not entitlement assertions.
- Purchase references are encrypted using AES-256-GCM with a dedicated stable server key. Provider errors are sanitized. Private keys, credentials and receipts do not enter public subscription DTOs.
- Entitlement and receipt writes are transactional; account and purchase revisions fence delayed verification, including older failures arriving after successful recovery. Linked active replacements retire the old token; pending replacements preserve current access. Provider outages never extend stored expiry.
- Google acknowledgement follows durable persistence and retries after failures. Apple finish follows successful server verification. Native listeners, restore, resume recovery, account-switch checks and store management are implemented.
- Apple signed notifications and Google authenticated Pub/Sub pushes are validated before encrypted work is persisted and HTTP 200 is returned. Notification leases and revision checks preserve new work arriving during processing. Boot and periodic reconciliation recover interrupted work.
- A durable provider claim prevents overlapping web/store checkout, including legacy active web subscriptions and pending checkouts. Web cancel/downgrade cannot overwrite store entitlements. Web and native screens link to the responsible store, and disclose that account deletion does not cancel store billing.

## Configuration and deployment

Billing defaults disabled unless STORE_BILLING_ENABLED=true. Missing/invalid enabled configuration fails startup without echoing secrets. Disabled native billing does not offer Paystack as a fallback; existing store provider claims still protect against a second web checkout.

Required shared settings: STORE_BILLING_PRODUCTS (JSON objects with store, productId, optional Google basePlanId, tier and billingCycle), STORE_RECEIPT_ENCRYPTION_KEY_BASE64 (32 bytes). Catalog entries must correspond to active public plans. Back up the encryption key with access controls; losing it prevents receipt reconciliation.

Apple settings: APPLE_IAP_ENVIRONMENT, APPLE_IAP_PRIVATE_KEY_BASE64, APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_BUNDLE_ID, APPLE_IAP_APP_ID (required for production), APPLE_IAP_ROOT_CERTIFICATES_BASE64 (JSON array). All supported tiers must share the intended subscription group. Environment is explicit; sandbox/TestFlight/App Review routing requires deployment validation.

Google settings: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, GOOGLE_PLAY_PACKAGE_NAME, GOOGLE_PLAY_ALLOW_TEST_PURCHASES, GOOGLE_PLAY_RTDN_AUDIENCE, GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT. Configure exact base plans and authenticated Pub/Sub delivery. Keep test purchases disabled in production unless deliberately running a controlled validation.

Authenticated endpoints: GET /api/v1/store-billing/catalog/:store, POST /prepare and POST /verify under the same prefix. Provider callbacks: /api/v1/webhooks/store/apple and /api/v1/webhooks/store/google. Verification accepts a store and reference, never a client tier or expiry.

MongoDB must support transactions (replica set/Atlas/mongos). Subscription settlement and store grants use sequential database operations inside transactions. CI now provisions a replica set; remote CI execution still needs verification after push.

## Web settlement recovery

Paystack checkout terminal state, subscription activation, coupon redemption and affiliate effects now commit atomically. Failures roll back and retries recover without duplicate commission or period extension. Provider references must match the persisted checkout. Concurrent initial free-subscription reads cannot overwrite a paid activation.

Historical SUCCEEDED checkouts created before this change may already have incomplete effects. Audit them against payment, subscription, coupon and affiliate records before any repair. Do not blindly replay successful checkouts: this can double-count benefits or overwrite a newer subscription. No production reconciliation or historical repair was performed.

## Verification and remaining engineering limitations

- Full API checkpoint before the later admin and stale-failure additions: 107 files / 743 tests pass. Follow-up ownership/API suites: 23 tests pass; admin-action regression and two admin UI tests pass. Billing-focused tests: 60, covering verifier state, ownership, encryption, rollback/restart, duplicate/concurrent settlement, acknowledgement retry, notification replay and disabled runtime. Existing payment regressions: 56 pass.
- Mobile suite: 36 tests pass; API/mobile type checks and lint pass. Web store-management regression passes. iOS/Android/web JavaScript exports pass. A fresh all-platform export also passes after website/fundraising changes. Isolated iOS native compilation is pending completion of dependency installation.
- These tests use isolated data and provider doubles. They do not prove real certificate/OCSP connectivity, real purchases, signed native builds or live notification delivery.
- Provider claims currently remain bound to the original provider; self-service cross-provider migration is not implemented. Do not manually release a claim without checking pending charges and future renewals.
- Purchase reconciliation has revision fencing but no distributed per-purchase fetch lease; multiple instances may repeat provider reads. Notification processing does have leases.
- Review-required notification/purchase records persist with sanitized errors. Admin Store billing recovery lists these records without receipts or encrypted references; the action center shows pending work counts. A reasoned retry is transactionally audited and scheduled without clearing review flags, stealing worker leases or granting access. API recovery/admin authorization tests pass. Staff must monitor the queue and investigate persistent issues; no automatic email or external alert was sent.

## Operator procedure

1. Open Admin → Store billing recovery. Disabled billing remains readable; retries require valid server configuration. Do not paste receipts, purchase tokens or credentials into review notes.
2. Investigate sanitized errors against store status, configured product/base plan, app identity, permissions and account ownership. Do not transfer a receipt to a different account or manually extend access.
3. Record the corrective action and queue a retry. The next worker run fetches authoritative store state. A queued response is not a resolved incident; review flags disappear only after successful verification.
4. Use the responsible store's refund/support tools for duplicate payments, refunds and unresolved store-account issues. Existing pre-transaction Paystack inconsistencies need their separate evidence-based audit above.
5. Monitor action-center counts and acknowledgement delays, including during disabled-runtime outages. A Google acknowledgement must meet the store deadline; an unresolved backlog is a release/operations incident, not a reason to grant unverified access.

## External release evidence

- Owner-confirmed product IDs/base plans, subscription groups, territories, localized pricing, store agreements and tax/banking setup.
- Real credentials/API permissions, trusted Apple roots, app identity and production notification endpoints.
- Signed-device sandbox purchase, renewal, restore after reinstall, account switching, pending/hold/grace/expiry, refund/revoke and outage recovery evidence on both stores.
- No real purchase, refund, store submission or production notification was sent during implementation.

## Authoritative implementation references

- [Apple App Store Server Library](https://github.com/apple/app-store-server-library-node): signed-data verification, trusted roots and production app identity.
- [Google subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions) and [subscriptions V2 resource](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2): current entitlement state and acknowledgement.
- [Google billing security](https://developer.android.com/google/play/billing/security): server validation, account binding, unique token ownership and linked-token/voided-purchase handling.
- [Pub/Sub push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions): token audience and sender verification.
- [Expo IAP source](https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap): native module pinned to 5.6.0 and integrated.
