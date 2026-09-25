# Ghana & store compliance, operations (102 cases)

Legal identity, consent records, data protection, financial authorization, store declarations, production configuration, security, monitoring and rollback.

[Back to the QA plan](../README.md)

## COMPLIANCE-01 · P0 · Operator identity clause (DevTrack BN843072020) is identical on Terms and Privacy across marketing, web and native

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Production builds of marketing and web deployed. A signed iOS/Android release build is installed. Tester is signed out. Reference text comes from LEGAL_ENTITY/companyClause in packages/types/src/legal.ts.

**Steps:**

1. Open https://ujimora.com/terms and read section '1. About Ujimora'.
2. Open https://ujimora.com/privacy and read section '1. Controller and scope'.
3. Repeat on https://app.ujimora.com/terms and https://app.ujimora.com/privacy.
4. On iOS and on Android, open Legal (the Legal hub, or deep links ujimora://terms and ujimora://privacy) and read the same sections.
5. Paste all four texts into a diff tool.
6. Enable airplane mode on the phone and reopen the Terms screen.

**Expect:** Every surface reads 'operated by DevTrack, registered in Ghana under registration number BN843072020, with a registered office at UNN House, Nii Osae Ntifu Avenue, East Legon, Accra, Greater Accra, Ghana'. Contacts shown are support@ and legal@ujimora.com. Effective date is 8 September 2026. The texts are identical on all four surfaces, and the native screens also render offline. No surface shows another entity name, a blank registration number or a placeholder.

**Needs:** None (bundled content). Owner confirmation of the correct entity is covered in COMPLIANCE-04.

**Source:** `packages/types/src/legal.ts`, `apps/web/src/pages/LegalPage.tsx`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/mobile/src/components/LegalScreen.tsx`, `docs/compliance/READINESS.md (C01)`

## COMPLIANCE-02 · P0 · All nine policies are publicly reachable, refresh-safe and listed on every surface

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Signed out. Have the list of policy slugs from LEGAL_POLICIES.

**Steps:**

1. For each slug (terms, privacy, organizer-agreement, contributor-terms, refund-policy, acceptable-use, cookies, billing-terms, delete-account), run curl -s -o /dev/null -w '%{http_code}' against https://ujimora.com/<slug> and https://app.ujimora.com/<slug>.
2. Open each URL in a browser and hard-refresh (tests the Vercel SPA rewrite).
3. Open https://ujimora.com/legal and https://app.ujimora.com/legal and confirm all nine cards are present.
4. On native, open the Legal hub, tap each 'Read policy', then tap 'All policies'.
5. Fetch https://ujimora.com/sitemap.xml and confirm /legal plus all nine policy URLs are listed.
6. Note each page's effective date.

**Expect:** Every policy returns HTTP 200 with correct content on every surface without login. No NotFound page appears after refresh. The hub lists all nine policies and the sitemap contains all nine. Effective dates are shown (8 Sep 2026; delete-account 12 Sep 2026).

**Needs:** Vercel hosting

**Source:** `apps/web/src/router.tsx`, `apps/marketing/src/App.tsx`, `apps/marketing/public/sitemap.xml`, `apps/mobile/src/navigation/deepLinks.ts`, `packages/types/src/legal.ts`

## COMPLIANCE-04 · P0 · The same legal entity appears on the App Store, Play, Paystack merchant, policies and review notes (C01/C19)

*Surfaces:* android, api, ios, marketing  ·  *Type:* compliance

**Before:** Access to App Store Connect, Play Console and the Paystack dashboard. Business-name certificate BN843072020 available. Owner has answered how DevTrack relates to Neurodyne Corp Ltd.

**Steps:**

1. In App Store Connect, confirm the account type is Organization (D-U-N-S enrolled) and note the Seller name.
2. In Play Console, note the developer name and the verified organization details.
3. In Paystack Settings, note the business name, registration number and settlement bank account holder.
4. Compare these with LEGAL_ENTITY and with the Privacy section 'Optional organization website requests', which names Neurodyne Corp Ltd as parent. Also check the registration screen's website-request wording.
5. Compare with the operator paragraph in apps/mobile/APP_REVIEW_NOTES.md ('Enrol DevTrack with its D-U-N-S number').

**Expect:** One consistent legal entity appears everywhere. If it changes, update packages/types/src/legal.ts and all store listings in one release. The Apple account is an Organization account, as required for financial apps (Guidelines 3.2.1(viii) and 5.1.1(ix)). The settlement account is in the operator's name. Any mismatch blocks submission. Known open issue I020: registration, the website-request notice and the Privacy notice still name Neurodyne Corp Ltd as parent company while Terms and Privacy section 1 name DevTrack (BN843072020) as operator; the owner has not yet confirmed the relationship (READINESS C01), so record the answer and the chosen entity before submission.

**Needs:** App Store Connect, Play Console, Paystack dashboard

**Source:** `packages/types/src/legal.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md (C01, C19)`

## COMPLIANCE-07 · P0 · Marketing, SEO and store metadata make no unsupported regulatory claims (escrow, protection, licensing)

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Store listing drafts and screenshots are available. Admin access to the production CMS (site content).

**Steps:**

1. Run curl -s https://ujimora.com | grep -i -E 'escrow|trust score' and inspect meta description, og:description, twitter:description, the JSON-LD block and /site.webmanifest. The expected wording is 'reviewed campaigns, verified organizers and transparent donation records'.
2. Open https://ujimora.com/pricing, app /subscription, the native Subscription screen and admin Manage plans. The escrowSupport feature is labelled 'Split proceeds' everywhere, with no 'Escrow & milestones' label.
3. Open https://ujimora.com/help and the production CMS FAQ. Confirm there is no 'community trust scores', 'funds frozen / permanently banned', 'anyone worldwide can donate' or Google/Facebook sign-up claim. The code fallback and seed file were fixed, but seedSiteContentIfEmpty only seeds an empty database, so FAQ text already stored in production must be edited in the admin if the old wording is still there.
4. Check the native verification banner reads 'Higher verification levels unlock higher campaign limits.'
5. Search store descriptions and screenshots for 'escrow', 'protected', 'licensed', 'regulated', 'guaranteed', 'verified campaigns' and 'trust scores'.
6. Ask legal whether 'verified organizers' and 'reviewed campaigns' are acceptable given the verification actually performed (see COMPLIANCE-88), and whether Ujimora operates any regulated escrow arrangement.

**Expect:** No escrow, protection, licensing or trust-score claim appears in marketing HTML, SEO metadata, the web manifest, plan features, the FAQ (code fallback and production CMS) or store metadata (Apple 2.3.1). The plan feature label matches what escrowSupport gates (split proceeds; CampaignSplitUseCase.ts:50). Any remaining claim is fixed or has written legal sign-off before launch.

**Needs:** Legal review

**Source:** `apps/marketing/index.html`, `apps/marketing/public/site.webmanifest`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/marketing/src/pages/HelpPage.tsx`, `apps/api/src/infrastructure/database/siteContentDefaults.json`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/admin/src/pages/ManagePlansPage.tsx`, `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`

## COMPLIANCE-08 · P0 · Public account-deletion resource meets the Google Play account deletion policy

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Signed out on a phone browser. Android release build installed.

**Steps:**

1. Open https://app.ujimora.com/delete-account and https://ujimora.com/delete-account.
2. Tap 'Open account settings on the website' and confirm login leads to /settings.
3. Tap the email-request action (see COMPLIANCE-05).
4. On Android, run adb shell am start -d ujimora://delete-account and confirm the policy screen opens.
5. In native Settings, confirm a 'Delete Account' entry exists.
6. Confirm /delete-account is in ujimora.com/sitemap.xml.
7. Paste the URL into Play Console > Data safety > account deletion and verify it loads outside the app.

**Expect:** The page loads without sign-in. It explains the in-app and email paths, what is retained (transaction, KYC, fraud and dispute records) and that store subscriptions must be cancelled separately. All links work. The URL in Play Console matches the published page.

**Needs:** Play Console

**Source:** `packages/types/src/legal.ts (delete-account policy)`, `apps/mobile/app/delete-account.tsx`, `apps/mobile/app/settings.tsx`, `apps/marketing/public/sitemap.xml`, `docs/compliance/READINESS.md (C06)`

## COMPLIANCE-09 · P0 · Web signup requires unchecked Terms and 18+ confirmations with a server-stamped record

*Surfaces:* api, web  ·  *Type:* compliance

**Before:** A new, unused email address. Staging with read access to MongoDB.

**Steps:**

1. Open https://app.ujimora.com/register.
2. Verify both boxes (terms acceptance, and 'I confirm that I am at least 18 years old.') start unchecked.
3. Fill every field, check only terms, and try to continue. The button is disabled or shows 'Accept the terms and confirm you are at least 18 to continue'.
4. Check both boxes and create the account.
5. In Mongo, read users.<id>.legalAcceptance.

**Expect:** Signup is impossible without both boxes checked. The stored record is {version:'2026-09-12', acceptedTerms:true, ageConfirmed:true, acceptedAt:<server time within seconds of the request>}.

**Needs:** None

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `packages/types/src/legal-acceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`

## COMPLIANCE-10 · P0 · iOS and Android signup have the same agreement and 18+ gates, stamped with server time

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Signed release builds on physical devices. For one run, set the device clock 2 days ahead.

**Steps:**

1. On iOS, open (auth)/register and confirm both checkboxes are unchecked and Register is disabled until both are checked.
2. Register an individual account.
3. Register an organization account and confirm the website-request option is unchecked by default.
4. Repeat on Android.
5. Inspect the stored legalAcceptance.acceptedAt for the account created with the skewed device clock.

**Expect:** Both platforms gate signup identically. acceptedAt reflects server time, not the skewed device clock. Organization signup has the same gates.

**Needs:** Physical iOS/Android devices

**Source:** `apps/mobile/app/(auth)/register.tsx`, `packages/types/src/legal-acceptance.ts`

## COMPLIANCE-11 · P0 · API rejects missing, stale or forged agreement payloads at registration

*Surfaces:* api  ·  *Type:* negative/edge

**Before:** curl access to the staging API: POST https://<staging-api>/api/v1/auth/register.

**Steps:**

1. POST with no legalAcceptance.
2. POST with version '2026-01-01'.
3. POST with acceptedTerms:false.
4. POST with ageConfirmed:'true' (a string).
5. POST a valid payload.
6. Count users before and after.
7. Send 31 register attempts from one client within 15 minutes.

**Expect:** The four invalid payloads return 400 validation errors and create no user. The valid payload returns 201. The 31st attempt returns 429 with a Retry-After header.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/legalAcceptanceSchema.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

## COMPLIANCE-12 · P0 · Legacy accounts cannot publish until they accept the current agreement; reading, settings and funds stay open

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A staging account whose legalAcceptance is removed or set to an older version in the DB. The account owns a campaign with a balance.

**Steps:**

1. Sign in on web. The banner 'Please review the account agreement before publishing or uploading content.' with a Review button appears. Its status comes from GET /api/v1/profile/legal-acceptance (current:false, requiredVersion 2026-09-12), not from the cached login user.
2. Try each publish action: create a campaign at /campaigns/new, post a comment, post an update, make the profile public, upload a campaign image. Each returns 428 (for example 'Accept the current account agreement before publishing.').
3. While signed in, change the DB record back to an old version and refocus the tab. The banner reappears after focus or after the next 428, without signing out.
4. Click Review, check both boxes and click 'Save agreement'. Expect 'Your agreement has been saved.' and the heading 'You’re up to date'. The banner disappears.
5. Retry the publish actions. They succeed.
6. Repeat on the native account-agreement screen, including bringing the app back to the foreground after changing the DB record; the status refreshes.
7. While not accepted, confirm Settings, data-rights requests, account deletion, the wallet view and payout requests are not blocked.

**Expect:** Publishing is blocked until acceptance, then succeeds. Web and native follow the server's current status rather than the cached login user. Non-publishing features are unaffected, as the contentAcceptance.ts policy requires. Acceptance is stored with a server timestamp and a 'reaccept' event is appended to legal_acceptance_events.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts (GET/POST /legal-acceptance)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.ts`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/web/src/lib/api.ts (ujimora:agreement-required)`, `apps/mobile/app/account-agreement.tsx`, `apps/mobile/src/lib/agreementStatus.ts`

## COMPLIANCE-14 · P0 · Guest donation with a public name or message requires 18+/terms acknowledgement before any payment is created

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Staging with Paystack test keys. An active GHS campaign. Tester signed out.

**Steps:**

1. On web, go to /c/<slug>/donate, enter amount 50, a donor name (not anonymous) and a message.
2. Confirm the checkbox 'I am at least 18 and agree to the terms for posting my public name and message.' appears unchecked and Donate is disabled.
3. Check the box and pay with a Paystack test card.
4. Inspect the donation intent: messageAgreement has version and acceptedAt.
5. Call the API directly: POST /api/v1/donation-intents with a message and no legalAcceptance.
6. Confirm the Paystack dashboard shows no new initialize for that call.
7. Repeat the UI steps on Android donate/[id].
8. Send legalAcceptance with a stale version.

**Expect:** UI and API both require the acknowledgement. The API returns 428 before creating an intent or calling Paystack, and the stale version is rejected. A valid acknowledgement is persisted with the intent.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/messageAgreement.ts`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/components/donate/MessageAgreement.tsx`, `apps/mobile/app/donate/[id].tsx`

## COMPLIANCE-17 · P0 · KYC 18+ date-of-birth enforcement on web, native, API and in admin approval

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A staging member with a verified email. An admin account. One pending KYC record seeded without a DOB.

**Steps:**

1. On web /kyc (identity step), open the DOB picker. The latest selectable date should be today minus 18 years (Ghana/UTC calendar date).
2. Enter a DOB of today minus 18 years plus 1 day. Expect 'You must be at least 18 to verify an Ujimora account.'
3. Enter exactly today minus 18 years. It is accepted.
4. Enter 2007-02-30. Expect 'Enter a valid date of birth.'
5. Leap-day check: DOB 2008-02-29 must be ineligible on 2026-02-28 and eligible on 2026-03-01 (verify with the latestAdultBirthDate logic or a staging clock).
6. POST the identity submission to the API with an underage DOB. Expect 400.
7. In admin /kyc-review, try to approve the seeded record with no DOB. It is rejected and the user's verification level is unchanged.
8. Repeat the UI checks on native app/kyc.tsx.

**Expect:** Underage and invalid DOBs are blocked on every surface. Staff cannot approve a record with a missing or underage DOB.

**Needs:** None

**Source:** `packages/types/src/adult-age.ts`, `docs/compliance/AGE_VERIFICATION.md`, `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`, `apps/web/src/pages/KYCPage.tsx`, `apps/mobile/app/kyc.tsx`

## COMPLIANCE-18 · P0 · KYC just-in-time data-use notice and acknowledgement before identity collection (Act 843 s.27, Play prominent disclosure)

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** A member who has not started KYC. An organization account for KYB.

**Steps:**

1. Open web /kyc and native KYC for identity. Before any document upload, confirm KYC_COLLECTION_NOTICE is visible.
2. Confirm the acknowledgement 'I confirm this information is accurate and I have read how my identity information is used.' is unchecked and submit is disabled until it is checked.
3. Repeat for organization KYB.
4. Tap 'Use my location'. Confirm location is requested only on tap and the one-shot use is explained.
5. Deny the location permission and complete the address manually.
6. Compare the notice text with the Privacy KYC section.

**Expect:** The notice appears before collection and the acknowledgement is mandatory. The location denial path works. The notice text is consistent with the privacy notice.

**Needs:** Cloudinary (uploads)

**Source:** `packages/types/src/adult-age.ts (KYC_COLLECTION_NOTICE)`, `apps/web/src/pages/KYCPage.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/src/components/OrganizationKYCForm.tsx`, `docs/compliance/READINESS.md (store-review hardening)`

## COMPLIANCE-21 · P0 · Push notifications are fully disabled, matching store declarations

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Fresh installs of signed iOS and Android 13+ builds. The production AAB/APK file. Read-only production DB access.

**Steps:**

1. Use the app through signup, donation (Android), settings and live viewing.
2. Confirm the OS notification permission prompt never appears.
3. On Android, check App info > Permissions: Notifications is not listed as requested.
4. Run aapt2 dump permissions (or bundletool dump manifest) on the release artifact. POST_NOTIFICATIONS must be absent.
5. Authenticated: POST /api/v1/notifications/push/register. Expect 503 and no token stored.
6. DELETE /api/v1/notifications/push/unregister twice. Both succeed.
7. Confirm Settings says 'SMS and device push notifications are not available yet…' (native) and 'SMS, browser push and campaign announcement delivery are not available yet…' (web).
8. Capture network traffic and confirm no Expo push or Firebase registration endpoints are contacted.
9. In production (read-only), count documents in the pushtokens collection and check which APNs/FCM credentials EAS holds.

**Expect:** No permission prompt, no notification permission and no push identifiers collected by current builds. Store privacy answers can truthfully say no push tokens are collected only once legacy tokens are purged. Known open issue I174: registrations from older installs may still exist in pushtokens and could receive OS-rendered background pushes; purge them (dry run first) and turn on Expo Enhanced Push Security or remove push credentials before submitting the privacy answers.

**Needs:** Physical devices, mitmproxy/Charles, production DB read access

**Source:** `apps/mobile/app.json (blockedPermissions)`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `apps/api/src/infrastructure/adapters/inbound/http/routes/notificationRoutes.ts`, `apps/api/src/infrastructure/database/models/PushTokenModel.ts`, `docs/compliance/PUSH_NOTIFICATIONS.md`

## COMPLIANCE-23 · P0 · DPC registration and a named privacy owner are in place before live personal data is processed (C02)

*Surfaces:* api, marketing  ·  *Type:* compliance

**Before:** Owner provides the Data Protection Commission registration evidence.

**Steps:**

1. Obtain the DPC registration certificate or reference.
2. Confirm the controller name matches the operator in LEGAL_ENTITY and the expiry/renewal date is after launch.
3. Identify the data protection supervisor/privacy owner and confirm they monitor legal@ujimora.com.
4. Confirm Privacy section 12 references the DPC complaint route.
5. Record the evidence in READINESS C02.

**Expect:** A valid registration exists in the operator's name and the privacy owner is named. If evidence is missing, the launch is not approved.

**Needs:** Data Protection Commission, owner

**Source:** `docs/compliance/READINESS.md (GH-DP, C02)`, `packages/types/src/legal.ts (privacy)`

## COMPLIANCE-24 · P0 · Processor inventory, contracts and cross-border transfer assessment match the Privacy notice and store answers

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Access to each vendor account.

**Steps:**

1. For each processor configured in production, record region, DPA/terms, retention, subprocessors and data categories: Render, MongoDB Atlas, Vercel, Cloudinary (cloud dvoqbonr2), Resend, OpenAI, LiveKit Cloud, Paystack, Apple, Google Play/Pub/Sub, plus Bitnob and Flutterwave only if enabled.
2. Compare with Privacy sections 5 and 6 and STORE_DATA_INVENTORY.md.
3. Write the transfer assessment for each non-Ghana processor.

**Expect:** Every processor has accepted terms and a documented transfer basis. Any processor without terms is disabled or removed before launch. The Privacy notice categories match.

**Needs:** Vendor dashboards, legal

**Source:** `docs/compliance/STORE_DATA_INVENTORY.md`, `docs/compliance/DATA_RIGHTS.md`, `render.yaml`, `packages/types/src/legal.ts (privacy sections 5-6)`

## COMPLIANCE-26 · P0 · Data-rights and privacy admin endpoints enforce isolation and the current admin role

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Users A and B, each with requests. Admin C.

**Steps:**

1. As B, GET /api/v1/data-rights. Only B's requests are returned.
2. As B, request A's request events by ID. Expect 403 or 404.
3. As a non-admin, call GET /api/v1/admin/data-rights and PUT /api/v1/admin/data-rights/:id/review. Expect 403.
4. Logged out, call the same endpoints. Expect 401.
5. Demote admin C to user in the DB, then have C publish a response with the existing token. Expect 403 'Current administrator access is required to review this request.'
6. Try to publish an in-app response to a closed account. It is refused. The external-delivery option requires an evidence reference.

**Expect:** No account can read another account's requests. The admin role is re-checked at write time.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/privacyRequestRoutes.ts`

## COMPLIANCE-27 · P0 · In-app account deletion end to end (Apple 5.1.1(v), Google Play)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Account A: donation history, a comment, a public profile, an open campaign with no unpaid balance, and a creator page with no unwithdrawn tips. Signed in on web and phone at the same time. An active store sandbox subscription on native. Account B: same setup plus a pending payout or a positive wallet balance. Account C: MFA enabled.

**Steps:**

1. On native (account A), open Settings > Delete Account. It shows 'Checking your balances and campaigns…', then the warning (records retained; store subscriptions must be cancelled in the store) and a warning that the open campaign will end.
2. Enter a wrong password and continue. An inline error appears and the phone stays signed in.
3. Enter the current password, tap 'Delete my account' and confirm 'Delete your account?' / 'This cannot be undone.'
4. Check the phone is signed out.
5. On web, the next API call returns 401 and the refresh token fails.
6. Try to sign in with the old credentials. It is rejected.
7. Check the public profile and creator page are hidden, comments are hidden and donations show as anonymous. The open campaign now has status expired and no longer accepts donations; any campaign that was in review is back to draft.
8. In admin /privacy-requests, confirm a deletion or residual-review entry exists.
9. Confirm donations, ledger and campaign totals are unchanged.
10. Confirm newsletter, activity alerts and push tokens were removed.
11. Account B: the screen shows 'Your account can’t be closed yet. First withdraw or resolve: …' naming the amount or payout, and 'If you can’t, contact support@ujimora.com and we’ll help you close your account.' No delete action is offered.
12. Account C: an 'Authenticator or recovery code' field is required in addition to the password.
13. Repeat for a fresh account through web Settings > Delete account. The 'Delete account' dialog includes the App Store / Google Play subscription warning, and double-clicking 'Delete my account' sends one request.

**Expect:** Deletion needs the current password (plus a code with MFA). It is refused with a plain explanation while money or payouts are outstanding. Otherwise the account closes immediately and sessions are revoked on all devices, and open campaigns end instead of staying live. The sweep completes personal-data cleanup while financial records stay intact. The store-cancellation warning is shown on web and native before confirmation. API-level checks are in COMPLIANCE-N008.

**Needs:** App Store/Play sandbox for the subscription variant

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts (DELETE /, GET /closure-check)`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/web/src/components/account/DeleteAccountDialog.tsx`, `apps/mobile/src/components/DeleteAccountSection.tsx`, `apps/mobile/app/settings.tsx`, `docs/compliance/DATA_RIGHTS.md`, `docs/compliance/READINESS.md (C07)`

## COMPLIANCE-29 · P0 · Private KYC documents: 60-second signed access, owner or admin only

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** User A with KYC uploads. User B. An admin. Cloudinary configured.

**Steps:**

1. As A, upload ID front, ID back and a selfie in /kyc. The client receives kyc://<id> references, not https URLs.
2. As A, GET /api/v1/uploads/kyc/:id/access. The response has a URL, expiresInSeconds 60 and Cache-Control no-store.
3. Open the URL. It works. Retry after 61 s. It is denied.
4. As B, request A's document ID. Expect 404 'Document not found'.
5. Logged out, request it. Expect 401.
6. As admin, preview the document in /kyc-review. It works, and an audit entry 'kyc.document.access' is logged without the URL.
7. Request an unauthenticated plain delivery URL for the asset's public_id. It is denied.
8. POST /api/v1/uploads/sign with folder kyc, ujimora/kyc and misc. Each returns 404: the direct-upload signer was removed and uploads go only through POST /uploads/image.
9. POST /uploads/image with a PDF to a non-kyc folder. Expect 415 'PDF files are only accepted for verification documents.'

**Expect:** KYC files are reachable only by the owner or a current admin, each access link works for 60 seconds, and no endpoint signs direct browser uploads.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/__tests__/integration/private-kyc-documents.integration.test.ts`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`

## COMPLIANCE-30 · P0 · Cloudinary production isolation, no unsigned uploads, legacy public KYC assets migrated

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Cloudinary console access. A privacy lead is available. The production web bundle.

**Steps:**

1. Confirm whether production still reuses the dev cloud dvoqbonr2 (render.yaml still sets CLOUDINARY_CLOUD_NAME dvoqbonr2 and says every dev machine with apps/api/.env holds production media credentials). Record whether development has its own cloud yet and whether the production API secret was rotated.
2. Download the production JS from app.ujimora.com and search for 'upload_preset' and the preset name 'ujimora'. VITE_CLOUDINARY_* were removed from apps/web/.env.production, so neither should appear. Confirm no VITE_CLOUDINARY_* variable is set in the Vercel project.
3. Under Upload presets, check preset 'ujimora' and disable or delete it.
4. Run curl -F upload_preset=ujimora -F file=@x.png https://api.cloudinary.com/v1_1/dvoqbonr2/image/upload.
5. Carry out PRIVATE_KYC_ROLLOUT steps 1-7: inventory legacy KYC assets, migrate them to authenticated delivery, invalidate the CDN, and verify unauthenticated denial of original and derived URLs.
6. The privacy lead records an incident assessment for any earlier public exposure.

**Expect:** The unsigned upload fails and the preset name is absent from every bundle. Production media is isolated from dev keys and no KYC asset is publicly reachable. An incident assessment is on record. Known open issue I033: the code no longer ships or uses the preset, but deleting the preset, migrating legacy public KYC assets, giving dev its own cloud and rotating the production secret are console tasks that are still open.

**Needs:** Cloudinary

**Source:** `render.yaml (CLOUDINARY_*)`, `apps/web/.env.production`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`

## COMPLIANCE-33 · P0 · BoG crowdfunding and regulated-partner authorization evidence is on file (C03)

*Surfaces:* api  ·  *Type:* compliance

**Before:** Owner and legal counsel available.

**Steps:**

1. Obtain written evidence covering collection, holding and disbursement of donation/reward crowdfunding funds (a BoG position or approved partner structure).
2. Obtain Paystack's written confirmation that DevTrack's merchant category permits third-party campaign collection and transfers to organizers.
3. Confirm Paystack live mode is activated and Transfers are enabled.
4. Confirm the settlement bank account is in the operator's name.
5. Record everything in READINESS C03.

**Expect:** Evidence exists before any live money is collected; without it, launch is not approved. A Paystack API key or a successful charge alone is not evidence.

**Needs:** Bank of Ghana, Paystack, legal

**Source:** `docs/compliance/READINESS.md (GH-CF, C03)`, `packages/types/src/legal.ts (REGULATORY_BASIS)`, `docs/paystack-owner-notifications-and-cashout.md`

## COMPLIANCE-34 · P0 · Wallet stored balances: legal decision and reconciliation to real funds

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A legal opinion has been requested. Admin /wallets access. Paystack balance and bank statement for a chosen date.

**Steps:**

1. Obtain legal's decision on whether holding user wallet balances (top-ups used to donate) is regulated stored value or e-money.
2. On a chosen cutoff date, sum all wallet balances (admin /wallets export) and compare with the Paystack balance plus the settlement bank statement, net of in-flight payouts and pending top-ups.
3. If wallets are not approved, confirm a plan to hide top-ups (web /wallet, Android WalletFunding, iOS external /wallet).

**Expect:** The legal decision is documented. Balances reconcile to the pesewa with provider and bank funds, or every difference is explained.

**Needs:** Paystack dashboard, bank statements

**Source:** `apps/web/src/pages/WalletPage.tsx`, `apps/mobile/src/components/WalletFunding.tsx`, `apps/api/src/infrastructure/adapters/outbound/payments/WalletTopUpService.ts`, `docs/compliance/READINESS.md (C03)`

## COMPLIANCE-35 · P0 · Current KYC gates campaign creation and payouts

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Staging accounts: unverified member; member with approved identity; organization with business verification; member whose KYC expiryDate is in the past; owner with an unverified email; a campaign with an open dispute. Paystack test transfers.

**Steps:**

1. As the unverified member, open /campaigns/new and GET /api/v1/campaigns/creation-options. Creation is blocked or limited.
2. As the verified member, create a campaign.
3. As the expired-KYC member, request a GHS payout (POST /api/v1/campaigns/:id/payouts). It returns 409 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.' No payout record is created.
4. As the owner with an unverified email, request a payout. It is refused with the same 409. The web dashboard and payout-accounts page show 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with a Send link button (native dashboard shows the same notice).
5. As an organization below level 3, request a payout. It is refused with the same 409.
6. Request a payout on the campaign with an open dispute. It returns 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.'
7. For an owner whose verification lapses after a request is queued, confirm the automatic path does not pay: the payout stays for manual review with a reason such as 'Current owner identity or organization verification requires manual review.' or 'Verify your email address to enable automatic payouts.', and manual approval is also refused (COMPLIANCE-36).

**Expect:** Financial privileges require current verification at request time and again at approval. Each refusal shows the exact message and no transfer is initiated. Approvals without an expiry date count as expired (COMPLIANCE-N013).

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/web/src/components/account/EmailVerificationNotice.tsx`, `docs/payments/automatic-payouts.md`, `docs/compliance/KYC_REVIEW_INTEGRITY.md`

## COMPLIANCE-36 · P0 · Manual payout approval is refused for an owner whose KYC is expired or unverified (AML control)

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging. A campaign owner with current KYC and an eligible balance. An admin who is not the owner. Paystack test transfers. DB access to expire the owner's KYC record.

**Steps:**

1. As the owner, request a standard (manual) payout while KYC is current. It is created as PENDING.
2. In the DB, set the owner's newest identity KYC expiryDate to yesterday (variants: rejected record, or a newer pending renewal).
3. As the admin, open the request in admin /payouts, enter a review note of at least 20 characters and Approve. Expect 409 'The account holder’s identity verification is missing, expired or under renewal. It must be current before funds can be paid out.' No transfer is initiated and the payout stays PENDING.
4. Repeat with a Ujimora Wallet destination payout. Same refusal.
5. As the owner, request another payout. It is refused with the same message at request time.
6. As the admin, use 'Reject request', enter a reason of at least 20 characters and click 'Reject payout'. The label becomes 'Rejected'. The owner sees the rejection reason in web payout history, the cleared amount returns to pending balance, and an audit entry exists. A reason under 20 characters is refused ('Give the owner a reason for the rejection (at least 20 characters).').
7. As an admin who owns the campaign or requested the payout, try to approve. Expect 403 'Another administrator must approve payouts from your own campaign or request.'
8. As a creator with expired KYC, request a creator withdrawal to bank or MoMo. Expect 'Verify your identity, or renew an expired verification, before withdrawing creator funds to a bank or mobile-money account.'

**Expect:** Money cannot leave through the manual, wallet-settlement or creator bank/MoMo rails unless the owner's KYC/KYB is current at approval time (checked inside the approval transaction). Staff can close ineligible or suspicious requests with a recorded reason, and self-approval is blocked. Remaining gaps (owner decisions under I011): there is no staff override with a recorded justification, and the admin payout card does not show the owner's KYC status or expiry, so staff rely on the refusal message and /kyc-review. Creator transfers to the in-app Ujimora Wallet are deliberately not gated.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `docs/compliance/READINESS.md (C13)`

## COMPLIANCE-37 · P0 · Large-campaign escalation, review alert email and staff approval

*Surfaces:* admin, api, email, web  ·  *Type:* compliance

**Before:** A first-time organizer with approved KYC. REVIEW_ALERT_EMAIL is monitored. Resend configured.

**Steps:**

1. Create a campaign with goal GHS 250,000. It goes live, subject to publication admission, because auto-approve max tier is 3.
2. Create one with goal GHS 250,001. Its status is pending_review.
3. Confirm the alert email reaches REVIEW_ALERT_EMAIL (info@ujimora.com) with a working https://admin.ujimora.com link.
4. In admin /campaigns/:id, approve with notes and attestations. An audit record is created.
5. In admin Settings, compare the campaign tier overrides with the env values (10000,50000,250000,1000000; auto-approve 3) and confirm the owner approved them.
6. As an organizer with current verification and a prior published campaign, create a campaign above GHS 250k. It is allowed per Terms section 7.

**Expect:** Behavior matches Terms section 7 and CAMPAIGN_APPROVAL.md. The review alert is delivered and the approval is audited.

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts`, `apps/api/src/application/services/CommercialConfigService.ts`, `docs/compliance/CAMPAIGN_APPROVAL.md`, `render.yaml`

## COMPLIANCE-38 · P0 · Payout maker-checker, review notes, self-approval block, single-transfer ceiling and early-withdrawal cap

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging with PAYOUT_DUAL_APPROVAL_AMOUNT=1000 (or the admin Settings override). Two admins who do not own the test campaign. Paystack test transfers. Production log access.

**Steps:**

1. Record the production value: render.yaml keeps PAYOUT_DUAL_APPROVAL_AMOUNT '0'. In production boot logs, confirm the warning 'PAYOUT_DUAL_APPROVAL_AMOUNT is 0: every campaign and beneficiary payout needs only one admin approval (maker-checker is off)…'. Get a written owner decision (STAFF_ACCESS.md records the accepted risk).
2. On staging, request a GHS 1,500 payout. Try to approve with no note or a note under 20 characters. It is refused (400 validation, or 422 'Record beneficiary ownership and receiving-capacity review before approving (at least 20 characters).').
3. Admin 1 approves with a note of at least 20 characters. It stays pending second approval.
4. Admin 1 approves again. Expect 409 'A second, different admin must approve this high-value payout'.
5. Admin 2 approves. The transfer is initiated exactly once.
6. An admin who owns the campaign or requested the payout tries to approve. Expect 403 'Another administrator must approve payouts from your own campaign or request.'
7. Request a MoMo payout above 50,000 (PAYOUT_MAX_TRANSFER_AMOUNT). Approval is refused with 'This payout exceeds the single-transfer ceiling…'.
8. Request an early payout for more than 80% of the eligible balance. Expect 'Early payouts are capped at 80% of the eligible balance (max GHS …).'
9. With one PENDING request outstanding, request another that together exceeds the eligible balance. Expect 422 'Cannot request a payout of GHS …; only GHS … is available for payout (GHS … is already in pending requests).'
10. Double-click Approve. Only one transfer results.

**Expect:** All payout controls are enforced, every approval carries a review note, self-approval is blocked, and pending requests reserve funds. The production threshold is a documented decision. Known open issue I029: production keeps single-admin approval (threshold 0) as an accepted risk until a second approving admin exists.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/config/index.ts (payouts)`, `apps/api/src/infrastructure/config/payoutControls.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `render.yaml`, `docs/compliance/STAFF_ACCESS.md`

## COMPLIANCE-39 · P0 · Fraud reports, safety reports and chargebacks reach staff; disputes and blocks hold funds without losing them

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A signed-in reporter. A live campaign with a balance and at least one settled Paystack donation. An admin. The Paystack test secret to sign webhooks.

**Steps:**

1. On web /c/<slug>, use 'Report campaign' and choose 'Fraud or scam' with details. From the native campaign screen, use Report Campaign (a reason is required; details up to 2,000 characters).
2. Report the same campaign again. The dialog shows the server's 409 'already reported' message.
3. Signed out on native, tap Report Campaign: 'Sign in to report this campaign' returns to the campaign after sign-in. Logged-out POST /api/v1/campaigns/:id/report returns 401. The creator sees no Report option on their own campaign.
4. In admin Trust & Safety > 'Campaign reports' (/campaign-reports), the report is pending with the reason chip 'Fraud or scam', links to the campaign and reporter, and the action center counts it.
5. Mark it reviewed with a note under 20 characters: not allowed. With a note of at least 20 characters: saved with reviewer, time and notes; a second or concurrent decision returns 409; an audit row exists; the reporter gets a neutral in-app acknowledgement.
6. File safety reports with reasons 'fraud', 'child_safety', 'intellectual_property' and 'privacy'. In admin /safety-reports, child_safety is listed first.
7. Send a correctly signed Paystack charge.dispute.create for a settled donation on the campaign. Admin /disputes shows one case with reporter 'Paystack (payment provider)', the transaction reference, amount and due date. Resending the same event creates no second case.
8. With the dispute open, the owner's payout request and any admin approval return 409 'This campaign has an unresolved dispute; payouts are paused until it is resolved.', and automatic payout is blocked.
9. Send charge.dispute.resolve. The case moves to under_review (never auto-closed) and payouts stay paused until staff resolve it with a resolution.
10. Block the campaign in admin. New donations are rejected, payout requests and approvals return 409 'This campaign is under review; payouts are paused', and the balance is unchanged.
11. Submit 21 safety reports in 15 minutes from one client. The last returns 429.

**Expect:** Campaign reports, safety reports and provider chargebacks all reach staff queues with an audit trail. Disputes and blocks hold funds without changing balances. Known open issue I009: chargebacks on tips, subscriptions and wallet top-ups are only logged and listed by API (COMPLIANCE-N014), and nothing reverses the ledger automatically. Known open issue I040 (owner decision): a payment that settles after a block still credits the blocked campaign; it is held, not refunded.

**Needs:** Paystack test secret for signed webhooks

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/admin/src/pages/CampaignReportsPage.tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `packages/types/src/campaign.ts (CAMPAIGN_REPORT_REASONS)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/admin/src/pages/DisputesPage.tsx`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`, `docs/compliance/MODERATION_OPERATIONS.md`

## COMPLIANCE-40 · P0 · AML/CFT programme, sanctions/PEP screening and FIC reporting SOP (tabletop)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Owner, legal counsel and the compliance officer available.

**Steps:**

1. Confirm Ujimora's status under Act 1044 (accountable institution, or reliance on Paystack) and name the compliance officer.
2. Document sanctions/PEP screening for organizers and beneficiaries. It is manual, because the source has no screening provider.
3. Document the suspicious-transaction escalation route to the FIC and the record-retention period.
4. Tabletop: a campaign receives 30 donations of GHS 9,999 from the same card within one hour. Who notices (the code has no automated transaction monitoring)? What is frozen: staff block the campaign (payout requests and approvals then return 409) and reject pending payouts with a recorded reason; staff cannot create a dispute themselves (disputes come only from Paystack chargeback events). What is reported, by whom and when?

**Expect:** A written SOP exists with named owners. The tabletop produces concrete actions using the tools that exist (campaign block, payout rejection, KYC re-check at approval), and the lack of automated monitoring is documented. Known open issue I089: no provider sanctions/PEP or liveness screening exists in KYC; the SOP must cover manual screening until one is contracted.

**Needs:** Legal, FIC guidance

**Source:** `docs/compliance/READINESS.md (GH-AML, C13)`, `docs/compliance/RFI_KYC_APPLICABILITY.md`, `packages/types/src/legal.ts (REGULATORY_BASIS)`, `apps/api/src/application/use-cases/ClosePendingPayoutUseCase.ts`

## COMPLIANCE-42 · P0 · No tax-deductibility claim on receipts, emails, UI or store text

*Surfaces:* android, email, ios, marketing, web  ·  *Type:* compliance

**Before:** A signed-in donor with donation activity email enabled. Paystack test keys.

**Steps:**

1. Complete a test donation. The 'Your donation is confirmed' email must contain 'This payment confirmation is not a charitable tax certificate.'
2. Search web, native and marketing copy, store descriptions, the Paystack receipt customization and the business description for 'tax', 'deductible', 'charity', 'tax-exempt' and 'receipt'.
3. Check Contributor Terms for a statement that contributions are not tax-deductible. None is present today, so ask legal.
4. Confirm organization 'Verified' labels do not imply charity or tax status.

**Expect:** No wording implies tax deductibility. A disclaimer appears wherever a receipt-like confirmation is issued.

**Needs:** Resend, Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `packages/types/src/legal.ts (contributor-terms)`, `docs/compliance/READINESS.md (GH-TAX, C14)`

## COMPLIANCE-44 · P0 · Price, tip and fee disclosure before payment; charged amount equals the ledger (money accuracy)

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Staging with Paystack test keys. A GHS campaign owned by a Community-plan organizer (3.5% platform fee).

**Steps:**

1. On web, donate GHS 100. Confirm the tip field is empty by default and labelled optional.
2. Note the total shown. On Paystack checkout, confirm the charge is exactly GHS 100.00.
3. Repeat with a tip of 5.55. Paystack shows 105.55 (10555 pesewas).
4. After the webhook, inspect the intent, donation and journal: gross 105.55, campaign-directed 100.00, tip 5.55, platform fee = plan % of 100, processor fee from the webhook. Campaign raised increases by exactly 100.00 and the journal balances.
5. Enter amounts 0.005, -1, 'abc' and 1e9. Each is rejected.
6. Apply a fee-waiver code. Only the platform fee drops; the gift is unchanged.
7. On Android, the button reads 'Donate 105.55 GHS' and Paystack charges 105.55.

**Expect:** Amounts are exact to two decimals and no tip is pre-selected. UI, Paystack and ledger all agree.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/application/use-cases/CreateDonationIntentUseCase.ts`, `apps/api/src/application/use-cases/SettleDonationUseCase.ts`, `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`

## COMPLIANCE-45 · P0 · Subscription price and renewal disclosure before purchase (web one-time Paystack plans; native IAP per Apple 3.1.2)

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** App Store sandbox tester and Play license tester. Store products configured. A web account with and without an active web plan.

**Steps:**

1. On web /subscription, before paying, confirm the price, the period ('/ 30 days' or '1 year') and 'One-time payment · does not auto-renew' on each plan card.
2. Start checkout. The confirmation reads 'One-time payment for 30 days. Your plan does not renew automatically.' (or 1 year). With the same plan already active it reads 'One-time payment. Adds 30 days after your current plan ends on <date>, so no paid time is lost. Your plan does not renew automatically.' Any coupon discount and the total are shown before Paystack opens.
3. On the active web plan card, confirm 'Ends in' (not 'Renews in'), no Cancel button, and 'Your plan does not renew automatically. Buy again before it ends to keep your benefits.'
4. Look for a link to /billing-terms on the page before paying. Read Billing Terms clauses 2-4 and confirm they match: web plans are one paid period with nothing to cancel; store plans renew under store terms; buying the same plan extends; a different plan replaces the current one without credit.
5. On web register, confirm the plan picker says 'for 30 days · one-time payment' (or 1 year).
6. On iOS, open the Subscription tab. Confirm the store-localized price and period, auto-renewal wording, links to Subscription terms, Terms of Use (EULA) and Privacy, 'Restore purchases', and a manage link that opens App Store subscriptions.
7. On Android, confirm the same with Play wording and a manage link.
8. Confirm no Paystack/web price or checkout link appears anywhere in the native apps.

**Expect:** All required disclosures are present. Web never implies auto-renewal or cancellation, native IAP discloses store auto-renewal, and the Billing Terms match what checkout shows. Log if missing: SubscriptionPage.tsx has no in-page link to /billing-terms (only the site footer), which legal may require next to the pay button. Known open issue I021 (READINESS C21): no tax line is shown pending the tax decision.

**Needs:** App Store sandbox, Play license testing

**Source:** `apps/web/src/pages/SubscriptionPage.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `packages/types/src/legal.ts (billing-terms)`, `docs/compliance/STORE_BILLING.md`

## COMPLIANCE-47 · P0 · Crypto is off in production on every surface

*Surfaces:* android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Production deploy. Render env has CRYPTO_PAYMENTS_ENABLED='false'.

**Steps:**

1. Run curl https://api.ujimora.com/api/v1/payments/crypto/assets. Expect enabled:false and assets [].
2. POST /api/v1/campaigns/:id/donations/crypto/quote and /donations/crypto. Both are rejected and no quote or deposit is created.
3. On web /c/<slug>/donate, confirm there is no crypto rail.
4. On Android, confirm the payment-method list has no 'Crypto' option.
5. On iOS, follow the browser donation flow and confirm the page has no crypto option.
6. On marketing /crypto, confirm the copy says availability varies and implies neither availability nor endorsement.

**Expect:** No surface accepts crypto. The App Review note and the Play financial-features answer ('no crypto') are accurate.

**Needs:** None

**Source:** `apps/api/src/infrastructure/config/index.ts (crypto)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoDonationRoutes.ts`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/marketing/src/pages/CryptoGuidePage.tsx`, `render.yaml`

## COMPLIANCE-49 · P0 · iOS: donations and wallet top-ups leave the app for Safari; no in-app payment anywhere

*Surfaces:* api, ios  ·  *Type:* compliance

**Before:** A TestFlight or production-signed iOS build with EXPO_PUBLIC_WEB_URL=https://app.ujimora.com. An active campaign with a slug and a legacy active campaign without a slug.

**Steps:**

1. Open a campaign and tap Donate. ExternalFundraisingScreen appears with no donor fields and the text 'Continue in your browser to choose an amount and pay by card or mobile money. To see this donation in your Ujimora donation history, sign in on the website with this account before you pay.' It does not mention fee review or the wallet.
2. Tap 'Continue in browser'. Safari (not an in-app sheet) opens https://app.ujimora.com/c/<slug>/donate. For the legacy campaign without a slug it opens /c/<campaign id>/donate and the website loads the donate page.
3. Check the URL contains only the slug or id, an optional amount and liveSessionId: no token, email or name.
4. In Safari, tap other app.ujimora.com links. You stay in Safari; nothing bounces back to the app (no associated domains).
5. Return to the app. It shows 'Returning to the app does not confirm payment. Check the payment status on the website before trying again.' and does not claim the payment succeeded.
6. On a live session, tap 'Support this campaign'. The same external flow runs.
7. Tap Wallet > Fund wallet. Safari opens /wallet.
8. Browse all screens for any in-app checkout, including pending-payment 'Open secure checkout' (PaymentStatus).
9. Confirm the DB shows no donation intents created from the iOS app during the test.

**Expect:** The iOS app collects no payments in-app (Guidelines 3.1.1 and 3.2.2(iv)), its copy describes only what the website offers, and legacy campaigns without a slug can still reach the website donation page.

**Needs:** TestFlight device

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/screens/ExternalFundraisingScreen.tsx`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/src/components/WalletFunding.tsx`, `apps/mobile/src/components/PaymentStatus.tsx`, `apps/mobile/app/live/[sessionId].tsx`, `docs/compliance/FUNDRAISING.md`

## COMPLIANCE-50 · P0 · Android: hosted Paystack checkout, return verification and idempotent retries

*Surfaces:* android, api  ·  *Type:* cross-platform

**Before:** Signed Android build pointing at staging. Paystack test keys.

**Steps:**

1. Donate. A browser tab opens an https Paystack checkout. Pay with a test card, then with test MoMo.
2. Return to the app. PaymentStatus calls /donation-intents/:id/verify and shows pending until the webhook settles.
3. Close the browser without paying. 'Open secure checkout' resumes the same reference with no new intent.
4. Double-tap Donate. Only one intent is created (idempotency key).
5. Enable airplane mode during checkout, then restore the network. The app recovers.

**Expect:** The payment is to a campaign, not a digital-goods purchase. No duplicate intents or charges are created.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/donate/[id].tsx`, `apps/mobile/src/lib/payments.ts`, `apps/mobile/src/components/PaymentStatus.tsx`, `docs/compliance/STORE_DATA_INVENTORY.md`

## COMPLIANCE-51 · P0 · Creator tips are unavailable in both native apps

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** A creator with tips enabled on web. A proxy capturing app traffic.

**Steps:**

1. Open creators/<handle> on iOS and on Android.
2. Confirm there is no payment form and no external tip button, and an explanation of unavailability is shown.
3. Try the tip path by deep link or by re-navigating.
4. In the proxy log, confirm no request to /api/v1/creators/<handle>/tips is sent.
5. As the creator on native, confirm balances and withdrawal remain accessible.

**Expect:** Neither native app collects tips. Existing creator funds are unaffected.

**Needs:** Proxy (mitmproxy/Charles)

**Source:** `apps/mobile/app/creators/[handle].tsx`, `apps/mobile/src/lib/creators.ts`, `docs/compliance/FUNDRAISING.md`

## COMPLIANCE-52 · P0 · Native subscriptions are IAP-only, server-verified and actually configured in production

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** render.yaml now declares STORE_BILLING_ENABLED, STORE_BILLING_PRODUCTS, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, the APPLE_IAP_* set and the GOOGLE_PLAY_* set as sync:false; the values must be pasted in the Render dashboard (existing Blueprint services do not auto-create them). Sandbox and license testers ready.

**Steps:**

1. In Render, confirm every store variable has a value before STORE_BILLING_ENABLED=true; with it true and a required key missing or invalid, the API refuses to boot.
2. Authenticated: GET /api/v1/store-billing/catalog/apple and /google. Expect available:true, with product IDs matching App Store Connect and Play.
3. On iOS, buy the monthly plan with a sandbox (TestFlight or App Review) account against the production API (APPLE_IAP_ENVIRONMENT=Production). Verification falls back to the sandbox environment (APPLE_IAP_ALLOW_SANDBOX_FALLBACK unset or true) and the plan activates. Admin revenue excludes the sandbox purchase and the export marks its environment.
4. Delete and reinstall, then tap Restore purchases. The plan is restored.
5. Sign in with a different account on the same device. The purchase does not transfer.
6. On Play, buy and confirm the order is acknowledged within 3 days in Play Console.
7. Cancel, let expire and refund in sandbox. The entitlement is removed after the store notification.
8. On web /subscription with the store-billed account, only 'manage in App Store/Google Play' is shown, with no web checkout.
9. Check admin /store-billing: the review queue is empty or handled.

**Expect:** IAP works end to end on production configuration, App Review sandbox purchases verify against the production API, and there is no Paystack fallback in native apps. Note: APPLE_IAP_ALLOW_SANDBOX_FALLBACK is read by the API but not declared in render.yaml (see COMPLIANCE-63).

**Needs:** App Store sandbox, Google Play license testing, Google Pub/Sub

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `render.yaml`, `docs/compliance/STORE_BILLING.md`

## COMPLIANCE-53 · P0 · Store server notifications: authenticity checked, replay-safe, correct URLs

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Store billing configured. App Store Connect and Play Console access.

**Steps:**

1. In App Store Connect, set the Server Notifications V2 URL to https://api.ujimora.com/api/v1/webhooks/store/apple and send a test notification. Expect 200 and processing.
2. POST a forged or invalid JWS to that URL. Expect 4xx and nothing persisted.
3. Send a Play RTDN push to /api/v1/webhooks/store/google with a correct OIDC token (audience GOOGLE_PLAY_RTDN_AUDIENCE). Expect 200.
4. Send without a bearer token, or with the wrong audience. Expect 401 or 403.
5. Replay the same notification twice. The effect is applied once.

**Expect:** Signatures are validated before anything is persisted, and processing is idempotent.

**Needs:** App Store Connect, Google Pub/Sub

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts (createStoreBillingWebhookRoutes)`, `apps/api/src/app.ts`, `docs/compliance/STORE_BILLING.md`

## COMPLIANCE-54 · P0 · App Privacy and Data safety answers match the signed binary's real network traffic

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** EAS production-signed builds on physical devices. mitmproxy or Charles with the device CA installed. Draft console answers.

**Steps:**

1. Fresh install, then browse signed out.
2. Exercise each feature: signup; KYC with camera, gallery and location; Android donation; sandbox subscription; live broadcast (LiveKit); AI writing; report/block; account deletion.
3. Record every host contacted and the data categories sent: api.ujimora.com, Cloudinary, LiveKit, Paystack, Apple/Google, and any Expo, Firebase or analytics hosts.
4. Compare with STORE_DATA_INVENTORY.md and with the App Store Connect App Privacy and Play Data safety drafts. Tracking should be No.
5. Confirm every host is https before answering 'encrypted in transit'.
6. Get the owner's sign-off and archive the submitted answers.

**Expect:** Declarations are complete and accurate: contact info, identifiers, financial info, photos/files, audio/video, a documented location precision decision, user content, purchase history and support records. No advertising or analytics SDK traffic is seen.

**Needs:** Physical devices, proxy tool, App Store Connect, Play Console

**Source:** `docs/compliance/STORE_DATA_INVENTORY.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/mobile/APP_REVIEW_NOTES.md`

## COMPLIANCE-55 · P0 · iOS release archive: privacy manifest, Info.plist and background modes

*Surfaces:* ios  ·  *Type:* compliance

**Before:** The production .ipa or xcarchive built with UJIMORA_RELEASE=1.

**Steps:**

1. Extract Ujimora.app and run python3 scripts/compliance/inspect-ios-privacy.py /path/Ujimora.app. Keep the JSON.
2. In Info.plist, check: ITSAppUsesNonExemptEncryption=false; NSLocalNetworkUsageDescription and the _expo._tcp Bonjour entry are absent; UIBackgroundModes is exactly [audio].
3. Check camera, microphone, photo, when-in-use location and Face ID purpose strings match app.json, and no always-location key exists.
4. Check the privacy manifest reasons (UserDefaults CA92.1, FileTimestamp, SystemBootTime, DiskSpace) and that nested SDK manifests are present.
5. Cold start: no Expo dev-launcher UI appears.

**Expect:** The archive matches the declarations and contains no development-only entries.

**Needs:** EAS build

**Source:** `scripts/compliance/inspect-ios-privacy.py`, `apps/mobile/app.json`, `apps/mobile/plugins/withReleaseInfoPlist.js`, `apps/mobile/eas.json`, `docs/compliance/NATIVE_PERMISSIONS.md`

## COMPLIANCE-56 · P0 · Android release AAB: target API 36, permissions, backup, Firebase auto-init, 16 KB pages

*Surfaces:* android  ·  *Type:* compliance

**Before:** The production-signed AAB. bundletool. A 16 KB page-size device or emulator.

**Steps:**

1. Run bundletool dump manifest and check targetSdkVersion=36 and allowBackup=false.
2. Confirm these permissions are absent: POST_NOTIFICATIONS, READ_MEDIA_IMAGES/VIDEO/AUDIO, READ_EXTERNAL_STORAGE, ACCESS_BACKGROUND_LOCATION, SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE_LOCATION.
3. Confirm FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PROJECTION are present.
4. Confirm the metadata firebase_messaging_auto_init_enabled=false and firebase_analytics_collection_enabled=false.
5. Run scripts/compliance/inspect-android-native.py. Expect the 27 known RELRO-end findings and nothing new; track them before 1 Feb 2027.
6. Install on the 16 KB device and exercise live video and image loading. No crash.
7. Review the Play pre-launch report.

**Expect:** The manifest matches the declarations and there are no new 16 KB regressions. The Play pre-launch report is clean.

**Needs:** Play Console, 16 KB device or emulator

**Source:** `apps/mobile/app.json`, `scripts/compliance/inspect-android-native.py`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `apps/mobile/plugins/withAndroidPageAlignment.js`, `apps/mobile/APP_REVIEW_NOTES.md (Android 16 KB)`

## COMPLIANCE-57 · P0 · Android media-projection foreground service: user-initiated, stoppable, with declaration video

*Surfaces:* android  ·  *Type:* compliance

**Before:** A signed build on an Android 14+ physical device. An organizer account with a live-capable plan. LiveKit Cloud credentials in the target environment.

**Steps:**

1. Go live, then tap Share screen. The system capture prompt appears.
2. Accept. A persistent notification is shown and viewers see the screen.
3. Tap Stop. The notification disappears.
4. Start again and deny the prompt. Nothing is captured and the camera broadcast continues.
5. Revoke capture from the notification shade.
6. Repeat the cycle three times and leave the app during sharing (check microphone behavior).
7. Record the video for the Play Console foreground-service declaration: 'User-initiated screen sharing during a live fundraising broadcast'.

**Expect:** The service runs only after explicit consent and stops cleanly. The declaration video is uploaded.

**Needs:** LiveKit Cloud, Play Console

**Source:** `apps/mobile/app.json (@livekit/react-native-expo-plugin enableScreenShareService)`, `apps/mobile/src/components/LiveVideo.tsx`, `apps/mobile/STORE_SUBMISSION.md`

## COMPLIANCE-59 · P0 · Store console declarations and the reviewer package are complete and working

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Console access. A reviewer demo account created in production. Render dashboard read access.

**Steps:**

1. App Store Connect: 18+ rating questionnaire (UGC, unrestricted web access), App Privacy, Privacy URL https://ujimora.com/privacy, Support URL https://ujimora.com/contact, EULA link, subscription group and products, export compliance.
2. Play Console: target audience 18+, content rating, Data safety, account deletion URL, financial features (crowdfunding via Paystack; no loans, investments or crypto), foreground-service declaration, Ads: No, App access with the demo credentials.
3. Replace every <...> placeholder in apps/mobile/APP_REVIEW_NOTES.md.
4. Confirm MIN_APP_VERSION_IOS and MIN_APP_VERSION_ANDROID are unset in Render (or not above the submitted build) during review, so reviewers never see 'Update required'.
5. On a clean device, sign in as the reviewer. Confirm role user (not admin), KYC approved, MFA and biometric off, and no wallet, campaign, creator or affiliate balance and no payout in progress, so in-app deletion can be tested end to end.
6. Check each claim in APP_REVIEW_NOTES on the build: Restore purchases is at Profile > Subscription ('Your subscription'); Manage store subscription appears only once a store subscription exists; Report Campaign is at the bottom of each campaign page (sign-in prompt when signed out, hidden from the creator); deletion asks for the current password (plus a code with MFA); the host's camera and mic turn off when leaving the app during a live broadcast.
7. Confirm browsing, a campaign draft and Report/Block are all reachable.
8. Confirm the screenshots match the current UI and show no in-app payment on iOS.

**Expect:** No placeholders remain, every statement in the review notes matches the build, and the reviewer account works end to end, including deletion.

**Needs:** App Store Connect, Play Console

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `apps/api/src/infrastructure/config/mobileApp.ts`, `docs/compliance/READINESS.md (C19)`

## COMPLIANCE-60 · P0 · UGC safeguards meet Apple 1.2 and Play UGC on native and web

*Surfaces:* admin, android, ios, web  ·  *Type:* compliance

**Before:** Two signed-in users. An admin. Content exists on each surface.

**Steps:**

1. Confirm Report is present on comments, campaign updates, donor messages, member and organization profiles, creator pages, live sessions and campaigns (web /c/<slug> 'Report campaign', guests sign in first; native Report Campaign dialog at the bottom of the campaign page). Reasons include 'Intellectual property / copyright' and 'Privacy or likeness'.
2. Confirm Block user is present on member profiles, organization profiles (web now has report/block controls and no fake Follow button), creators and live sessions, and /c/<slug> offers report and block of the organiser. Settings lists blocked users with Unblock.
3. On native, tap a comment author's name or avatar to open their profile. A hidden or blocked profile shows 'This profile is not available.' but still offers Report and Block.
4. Confirm posting requires the current agreement (see COMPLIANCE-12).
5. Submit a report. It appears in admin /safety-reports (campaign reports in /campaign-reports).
6. The admin hides the content. It disappears for all viewers; the reporter gets a neutral in-app acknowledgement and the author gets an in-app notice.
7. The admin restricts publishing for the author. The author's next post is refused with the appeal contact shown, and the author appears in the admin 'Restricted users' view. Restoring requires confirmation and is audited.
8. An admin who filed the report, or who authored the reported content, tries to review it. Expect 403.
9. Confirm blocked users' content is hidden in both directions.

**Expect:** Report and Block controls are present on every native and web surface, moderation decisions are notified in-app, reviewers cannot judge their own reports, and the moderation queue works end to end.

**Needs:** None

**Source:** `docs/compliance/MODERATION_OPERATIONS.md`, `docs/compliance/CONTENT_MESSAGES.md`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/mobile/src/components/ReportCampaign.tsx`, `apps/mobile/app/profile/[id].tsx`

## COMPLIANCE-62 · P0 · Mobile production build points at the HTTPS production API and web origins

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** EAS project access. A proxy to capture app traffic.

**Steps:**

1. Confirm apps/mobile/eas.json production env sets UJIMORA_RELEASE=1, EXPO_PUBLIC_API_URL=https://api.ujimora.com/api/v1 and EXPO_PUBLIC_WEB_URL=https://app.ujimora.com, and that no EAS environment variable or secret overrides them with another host.
2. Install the production build and confirm it launches and loads campaigns. A build without EXPO_PUBLIC_API_URL throws 'EXPO_PUBLIC_API_URL is required for production builds'.
3. Build a test variant with an http:// API URL. It fails at startup with 'EXPO_PUBLIC_API_URL must use HTTPS in production'.
4. Share a campaign. The link uses https://app.ujimora.com/c/<slug>.
5. Confirm app.json has updates.enabled:false (no OTA). Record in the rollback plan that the only server-side lever for native builds is the minimum-version gate (GET /api/v1/app/config; COMPLIANCE-N011).
6. In the proxy log, confirm every request goes to https://api.ujimora.com, including GET /api/v1/app/config at launch.

**Expect:** The build targets HTTPS production and contains no development hosts. OTA is disabled and the minimum-version check reaches production.

**Needs:** EAS, proxy tool

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/eas.json`, `apps/mobile/app.json (updates.enabled)`, `apps/mobile/src/components/UpdateRequiredGate.tsx`

## COMPLIANCE-63 · P0 · Production environment variable audit on Render (presence and validity, values never copied)

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Render dashboard access to ujimora-api > Environment and its logs.

**Steps:**

1. Check NODE_ENV=production and MONGODB_URI (Atlas SRV, TLS, replica set, production database name).
2. Check JWT_SECRET and JWT_REFRESH_SECRET are at least 32 characters and different.
3. Check CORS_ORIGINS lists exactly the four https origins (the API now refuses to boot in production if it is empty), PUBLIC_WEB_URL=https://app.ujimora.com and PUBLIC_API_URL=https://api.ujimora.com.
4. Check PAYSTACK_SECRET_KEY starts with sk_live_, the public key with pk_live_, and PAYSTACK_APPROVAL_REQUIRE_SIGNATURE=true.
5. Check RESEND_API_KEY, FROM_EMAIL=no-reply@ujimora.com, REPLY_TO_EMAIL=support@ujimora.com, REVIEW_ALERT_EMAIL and ADMIN_WEB_URL.
6. Check AUTH_EMAIL_ENCRYPTION_KEY_BASE64 decodes to 32 bytes and MFA_ENCRYPTION_KEY is 44-character base64 of 32 bytes. Both are now declared sync:false in render.yaml, but an existing Blueprint service does not auto-create new sync:false variables, so confirm each has a value.
7. Check the STORE_BILLING_*, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, APPLE_IAP_* and GOOGLE_PLAY_* entries (declared sync:false) have values if store billing is launching.
8. Check LIVEKIT_*, CLOUDINARY_* and OPENAI_API_KEY.
9. Record whether these variables, which the API reads but render.yaml does not declare, are set and intended: PAYSTACK_CHANNELS (default card,mobile_money), RECONCILIATION_SCHEDULER_ENABLED (default true in production), APPLE_IAP_ALLOW_SANDBOX_FALLBACK (default true), MIN_APP_VERSION_IOS/ANDROID and APP_STORE_URL_IOS/ANDROID (default unset, Play URL built in).
10. Check no numeric fee variable is blank, CRYPTO_MOCK_WEBHOOK_SECRET is absent and LOG_LEVEL=info.
11. After a deploy, read the boot logs: no 'Production capabilities disabled by missing configuration' error; 'Optional production capabilities are off' only if store billing is intentionally off; no 'OPENAI_API_KEY missing…' error; the PAYOUT_DUAL_APPROVAL_AMOUNT warning matches the recorded decision.
12. Record present or absent for each variable, with an owner.

**Expect:** Every required variable is present and valid, keys are unique per purpose and stored only in Render secrets, and the boot logs show no capability faults. Undeclared optional variables are documented. Note for engineering: render-blueprint.test.ts asserts that every variable the API reads is declared in render.yaml; PAYSTACK_CHANNELS, RECONCILIATION_SCHEDULER_ENABLED and APPLE_IAP_ALLOW_SANDBOX_FALLBACK are read but undeclared on integrate/launch-fixes, so that test is expected to fail until they are added.

**Needs:** Render dashboard

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/app.ts`, `apps/api/__tests__/infrastructure/render-blueprint.test.ts`, `DEPLOYMENT.md (API secrets set in the Render dashboard)`, `docs/compliance/ACCOUNT_EMAILS.md`

## COMPLIANCE-64 · P0 · Password recovery and email verification work in production

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** A real production test account and inbox. Render log access.

**Steps:**

1. On web /login, type the email, then click 'Forgot password?' under the password field. /forgot-password opens with the email prefilled (the email is not put in the URL).
2. Request a reset. The response is the generic success, not 'Password recovery is temporarily unavailable. Please try again later.' Repeat with the email padded and in mixed case (' User@Example.com '): same success, and the email arrives because the server normalises it.
3. The email arrives from no-reply@ujimora.com with replies going to support@, and the link opens https://app.ujimora.com/reset-password with the token in the URL fragment.
4. Reset the password. Other sessions are revoked and a 'Your Ujimora password changed' notice arrives.
5. Reuse the link. It is rejected. Request another link and wait more than 30 minutes. It has expired.
6. Request a reset for an unknown email. Response and timing look the same.
7. Send 31 forgot-password requests from one client in 15 minutes. The page shows 'Too many attempts. Please wait about 15 minutes and try again.' Offline, it shows 'Can't reach Ujimora. Check your connection and try again.'
8. Register a new account. A 'Verify your Ujimora email address' email arrives without asking. Before verifying, the web dashboard shows 'Verify your email address. Automatic payouts and organization invitations need a verified email address.' with a Send link button; sending shows 'Check your email for a verification link. Allow a minute before requesting another.' The confirm page needs a button click.
9. Repeat the reset from native forgot-password and check its error messages for 429 and offline.
10. Check the production boot logs contain no 'Production capabilities disabled by missing configuration' line.

**Expect:** Password reset and email verification both work in production, users can find reset from the web login, a verification link is sent at signup, and rate-limit and connection errors are explained accurately. They depend on AUTH_EMAIL_ENCRYPTION_KEY_BASE64, Resend and an HTTPS PUBLIC_WEB_URL (AccountEmails.configured).

**Needs:** Resend

**Source:** `apps/web/src/components/auth/LoginForm.tsx`, `apps/web/src/pages/ForgotPasswordPage.tsx`, `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/web/src/components/account/EmailVerificationNotice.tsx`, `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/mobile/app/forgot-password.tsx`, `apps/mobile/src/lib/authMessages.ts`

## COMPLIANCE-66 · P0 · Launch feature flags and commercial-config overrides match signed decisions

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Render env and log access. Admin Settings access. Owner and legal available.

**Steps:**

1. Record the production value of each flag and attach a decision: SPLIT_PROCEEDS_ENABLED (render.yaml 'true' with comment '§6 cleared', but config/index.ts says it needs Ghana legal §6 sign-off; attach that sign-off), CRYPTO_PAYMENTS_ENABLED=false, PAYMENTS_MULTI_CURRENCY_ENABLED=false, PAYMENTS_INTERNATIONAL_CARDS_ENABLED=false, PAYMENTS_FLUTTERWAVE_ENABLED=false, AI_WRITING_ENABLED=true (OpenAI terms), PAYMENTS_RECONCILIATION_ENABLED=true, PAYOUT_DUAL_APPROVAL_AMOUNT=0, CAMPAIGN_AUTO_APPROVE_MAX_TIER=3, AFFILIATE_*.
2. Also record the new, undeclared settings: RECONCILIATION_SCHEDULER_ENABLED, PAYSTACK_CHANNELS, APPLE_IAP_ALLOW_SANDBOX_FALLBACK and MIN_APP_VERSION_IOS/ANDROID.
3. In the production boot logs, confirm the maker-checker warning appears while PAYOUT_DUAL_APPROVAL_AMOUNT=0.
4. Open admin Settings and record overrides that take precedence over env: tiers, review alert email (also used for contact-form alerts), referral discount, payout fees.
5. Call GET /api/v1/campaigns/creation-options and check splitEnabled matches the decision.

**Expect:** Every flag and override has a documented owner decision. Known open issue I013: SPLIT_PROCEEDS_ENABLED is 'true' without the §6 legal sign-off the code requires. Known open issue I029: maker-checker is off by owner decision (accepted risk in STAFF_ACCESS.md) and production logs a warning at every boot.

**Needs:** Render dashboard

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/payoutControls.ts`, `apps/api/src/application/services/CommercialConfigService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`, `docs/compliance/STAFF_ACCESS.md`

## COMPLIANCE-67 · P0 · HTTPS redirects, HSTS and certificates on every domain

*Surfaces:* admin, api, marketing, web  ·  *Type:* security/permission

**Before:** curl and a browser.

**Steps:**

1. Run curl -sI against http://ujimora.com, http://www.ujimora.com, http://app.ujimora.com, http://admin.ujimora.com and http://api.ujimora.com/health. Each returns 301/308 to https.
2. Confirm the https responses include Strict-Transport-Security.
3. Check certificate validity and that expiry is more than 30 days away.
4. Confirm www redirects to the canonical host.
5. Check the browser console for mixed-content warnings on the home, campaign, donate and admin login pages.
6. Confirm the /api/v1 rewrite in vercel.json targets https://api.ujimora.com.

**Expect:** Every domain is served over https with HSTS, and no page loads mixed content.

**Needs:** DNS, Vercel, Render

**Source:** `vercel.json`, `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `apps/api/src/app.ts (helmet)`

## COMPLIANCE-68 · P0 · CORS allows only the configured origins and production cannot start with an open policy

*Surfaces:* api  ·  *Type:* security/permission

**Before:** curl. A staging service you can restart with changed env.

**Steps:**

1. Run curl -sI -H 'Origin: https://evil.example' https://api.ujimora.com/api/v1/campaigns. No Access-Control-Allow-Origin header.
2. Repeat with Origin https://app.ujimora.com, https://admin.ujimora.com, https://ujimora.com and https://www.ujimora.com. Each is echoed with Access-Control-Allow-Credentials: true (web and admin now call the API origin directly, so this matters for every request).
3. Repeat with a Vercel preview origin (https://<project>-<hash>.vercel.app). It is not allowed.
4. Send an OPTIONS preflight for POST /api/v1/auth/login from the evil origin. Nothing is allowed.
5. On staging, start the API with NODE_ENV=production and CORS_ORIGINS empty (or ','). It refuses to start with 'CORS_ORIGINS is required in production (comma-separated browser origins)'. Note whether Render keeps the previous deploy serving.

**Expect:** Only the four approved origins are allowed, and a missing or blank CORS_ORIGINS stops a production boot instead of reflecting any origin.

**Needs:** Staging service

**Source:** `apps/api/src/app.ts (cors)`, `apps/api/src/infrastructure/config/index.ts (corsOrigins, production guard)`, `render.yaml`

## COMPLIANCE-69 · P0 · No server secret in repo history, web bundles or native bundles; rotation log exists

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* security/permission

**Before:** Production bundles. gitleaks or trufflehog.

**Steps:**

1. Download the production JS for app, admin and marketing. Search for sk_live, sk_test, re_ (Resend), OpenAI key patterns, LIVEKIT, api_secret and BEGIN PRIVATE KEY.
2. Unzip the APK and IPA JS bundles and run the same search.
3. Run gitleaks over the whole git history. credentials.txt must remain untracked (it is gitignored).
4. Rotate any credential ever shared outside the secret manager (for example in credentials.txt, chat or docs): Paystack, Atlas, Cloudinary (the dev cloud is reused in production), JWT secrets.
5. Confirm GitHub Actions secrets are CI-only values.

**Expect:** No server secret appears in any shipped bundle or in git history. A rotation log exists.

**Needs:** gitleaks/trufflehog

**Source:** `.gitignore`, `apps/web/.env.production`, `DEPLOYMENT.md`, `.github/workflows/ci.yml`

## COMPLIANCE-70 · P0 · Hosting tier and database setup suit real money (Render free plan, Atlas M0, network access)

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Render and Atlas dashboards. Paystack test mode on a staging instance configured the same way.

**Steps:**

1. Confirm the plan of ujimora-api. render.yaml still says plan: free, and its header now documents the limits: spin-down after 15 minutes idle (about 1 minute to wake, webhooks included), restarts at any time, the 750 free hours per month, and in-process jobs pausing while asleep. Get the owner decision on plan: starter.
2. Confirm the service's Health Check Path is /health/ready (COMPLIANCE-N001).
3. On a free-plan staging instance, idle 20 minutes, then send a Paystack test webhook. Measure response time against Paystack's timeout and retry behavior.
4. Confirm that setInterval jobs (reconciliation, erasure, store billing, alerts, campaign expiry) do not run while the instance sleeps.
5. In Atlas, confirm the cluster tier supports backups and transactions (M0 has no backups).
6. Confirm Network Access is not 0.0.0.0/0 (DEPLOYMENT.md now recommends a restricted access list) and the DB user has least privilege.
7. Confirm the service runs exactly one instance.

**Expect:** The API runs on an always-on paid instance with a backed-up cluster and restricted network access, or each gap is formally risk-accepted. Known open issue I003: render.yaml still uses plan: free; only the readiness check and documentation were added. Known open issue I099: rate limiters and the SSE event bus are per-process, so the service must stay at one instance.

**Needs:** Render, MongoDB Atlas, Paystack

**Source:** `render.yaml`, `DEPLOYMENT.md`, `apps/api/src/app.ts (scheduled jobs, /health/ready)`

## COMPLIANCE-71 · P0 · Rate limiter keys on the real client IP from Render's edge, not the proxy

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Two devices on different networks (for example home broadband and a mobile hotspot). A test account. Production web and admin built with VITE_API_URL=https://api.ujimora.com/api/v1. Audit-log access.

**Steps:**

1. In DevTools Network on https://app.ujimora.com and https://admin.ujimora.com, confirm API calls go directly to https://api.ujimora.com/api/v1/… (not app.ujimora.com/api/v1).
2. From network A, send 31 POST requests to https://api.ujimora.com/api/v1/auth/login with a wrong password. The 31st returns 429 {message:'Too many requests, please try again later'} with Retry-After.
3. Immediately, from network B, sign in on the web app. It succeeds, and X-RateLimit-Remaining on network B's first login response is 29 (of 30).
4. From network A, retry with forged X-Forwarded-For, X-Real-IP, True-Client-IP and X-Vercel-Forwarded-For headers. Still 429 (see COMPLIANCE-N003).
5. Make an admin mutation from network B and read the new audit-log entry. Its ip is network B's public IP, not a Render or Cloudflare address.
6. Repeat the login burst through the legacy rewrite https://app.ujimora.com/api/v1/auth/login and record the behavior.

**Expect:** Limits apply per client IP (from CF-Connecting-IP), so one abusive client cannot lock out other users, and the mutation audit trail records the client IP. Through the legacy Vercel rewrite every caller appears as a Vercel egress IP and shares that bucket; this path remains only for old cached bundles and the marketing site (COMPLIANCE-N004).

**Needs:** Two networks

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/web/.env.production`, `apps/admin/.env.production`, `DEPLOYMENT.md`

## COMPLIANCE-74 · P0 · Admin console and admin APIs enforce the admin role on the server

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A member account and an admin account.

**Steps:**

1. Sign in to https://admin.ujimora.com as a member with the correct password. The form shows 'This account does not have staff access.' and no session is stored; a reload stays on sign-in.
2. Call POST /api/v1/auth/login with audience:'admin' for the member. Expect 403 with the same message and no tokens, plus an audit event auth.admin_console.refused.
3. Paste a member's tokens into the admin console's storage. The console treats the session as signed out.
4. As the member: GET /api/v1/rbac/me returns an empty permission list and empty role name; GET /api/v1/analytics/overview returns 403; GET /api/v1/users/:id/public contains no role field.
5. As the member, call admin APIs: GET /api/v1/users (admin list), /api/v1/admin/wallets, /api/v1/admin/donations, /api/v1/admin/payments, /api/v1/admin/refund-requests, /api/v1/kyc/pending, /api/v1/audit, /api/v1/admin/commercial-config, POST /api/v1/admin/users/:id/close and a payout approve endpoint under /api/v1/payouts. Each returns 403.
6. Call the same APIs logged out. Each returns 401.
7. Demote the admin in the DB. The next request with the old token returns 403.
8. Confirm admin/index.html contains robots noindex.
9. Confirm admin mutations appear in the audit log with the actor and the client IP.
10. Start an export, then demote the admin mid-export. The export aborts.

**Expect:** The server enforces the admin role on every admin endpoint, and the console refuses member accounts before any token is issued; the UI guard is not the only check.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/context/AuthContext.tsx`, `apps/api/src/app.ts (route mounts)`, `apps/admin/src/router.tsx`, `docs/compliance/ADMIN_EXPORTS.md`, `docs/compliance/STAFF_ACCESS.md`

## COMPLIANCE-75 · P0 · Payment webhook authenticity, tamper resistance and replay safety

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Staging with Paystack test keys. Paystack dashboard webhook set to .../api/v1/webhooks/paystack.

**Steps:**

1. POST a charge.success to /api/v1/webhooks/paystack with no x-paystack-signature. It is rejected and nothing settles.
2. POST with a wrong HMAC. It is rejected.
3. Use 'Resend' in the Paystack dashboard to replay a real event twice. The donation settles once with a single ledger entry.
4. Send a correctly signed event whose amount does not match the intent. Nothing is credited.
5. Send a transfer-approval callback without a signature. It is declined (PAYSTACK_APPROVAL_REQUIRE_SIGNATURE=true).
6. POST to /api/v1/webhooks/flutterwave without verif-hash. It is rejected (rail disabled).

**Expect:** Money moves only on authentic, matching, first-seen events.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/paystackWebhookRoutes.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/FlutterwaveWebhookController.ts`, `render.yaml`

## COMPLIANCE-77 · P0 · Production logs and error responses contain no personal data, secrets or internals

*Surfaces:* api  ·  *Type:* compliance

**Before:** Render log access.

**Steps:**

1. Call GET /api/v1/campaigns/not-an-id. Expect 400 'Invalid ID format'.
2. Send malformed JSON. Expect 400.
3. On staging, force a 500. The response says only 'Internal server error', with no stack.
4. Run a flow set in production-like conditions: register, login, forgot password, donation with a message, KYC upload, an overlay URL with ?token=, and a Paystack bank resolve.
5. Search the Render logs for '@', 'token=', 'reset', 'Bearer', phone numbers, account numbers and email addresses. Expect no hits. Paths should appear as route templates (for example /campaigns/:id).
6. Confirm the audit-log documents contain no request bodies.

**Expect:** Logs and error responses contain no personal data or secrets, as LOGGING_PRIVACY.md requires.

**Needs:** Render logs

**Source:** `apps/api/src/infrastructure/logging/logger.ts`, `apps/api/src/infrastructure/logging/privacy.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requestLogger.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`, `docs/compliance/LOGGING_PRIVACY.md`

## COMPLIANCE-79 · P0 · Backup and restore drill with ledger verification and key escrow

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** An Atlas tier with backups. An isolated restore cluster and a staging API.

**Steps:**

1. Enable scheduled or continuous Atlas backups.
2. Restore the latest snapshot to the isolated cluster and point the staging API at it.
3. Verify login, campaign totals and wallet balances.
4. Run npx tsx scripts/audit-donation-settlement.ts <cutoff> on the restored DB until nextCursor is null. Expect exit 0 or triaged findings.
5. Confirm STORE_RECEIPT_ENCRYPTION_KEY_BASE64, AUTH_EMAIL_ENCRYPTION_KEY_BASE64 and MFA_ENCRYPTION_KEY are escrowed separately. Losing the MFA key locks out MFA users; losing the receipt key breaks store reconciliation.
6. Record the RPO and RTO achieved.
7. Decide backup and retention for Cloudinary media.

**Expect:** The restore succeeds within the agreed RTO and the encryption keys are recoverable. This matters given the earlier data-loss incident.

**Needs:** MongoDB Atlas backups

**Source:** `apps/api/scripts/audit-donation-settlement.ts`, `docs/compliance/HISTORICAL_DONATION_AUDIT.md`, `docs/compliance/STORE_BILLING.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`, `DEPLOYMENT.md`

## COMPLIANCE-82 · P0 · Rollback and kill-switch drill for API, frontends, database and mobile

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* recovery/idempotency

**Before:** Render and Vercel access. Staging. Installed staging mobile builds.

**Steps:**

1. Render: deploy a harmless change, then use Rollback. The service is healthy again (/health/ready 200) in under 5 minutes.
2. Vercel: use Instant Rollback on web, admin and marketing.
3. Confirm render.yaml autoDeployTrigger: checksPass is active: a push to main with failing CI does not deploy, a passing push does, and Manual Deploy works for an urgent fix. Confirm branch protection on main and Vercel Deployment Protection on previews (previews use the production API through the rewrite).
4. Confirm DB migrations such as migrate-refund-index.ts work with the previous release.
5. Kill switches: PAYMENTS_PAYSTACK_ENABLED=false (donate is disabled gracefully); in admin Payment providers, switch the Paystack gateway off and back on (label 'Disabled' while off; it stops new donation checkouts); AI_WRITING_ENABLED=false; STORE_BILLING_ENABLED=false (existing entitlements kept); crypto stays off; admin can block a campaign.
6. Mobile: confirm there is no OTA channel (app.json updates.enabled:false). On staging, set MIN_APP_VERSION_ANDROID/IOS above the installed build: the app shows 'Update required' at launch and on resume. Unset it: the app works again. An invalid value stops the API from booting. Document the expedited-review hotfix path.

**Expect:** Rollback steps are timed and documented, deploys are gated by CI, every kill switch is verified, and the minimum-version gate is documented as the native lever. Known open issue I047: the admin gateway switch does not stop wallet top-ups, subscriptions, tips, payouts or the Android donate screen, and the wallet switch only hides the website option. Known open issue I034: there is no staging environment and previews call the production API.

**Needs:** Render, Vercel

**Source:** `render.yaml (autoDeployTrigger, healthCheckPath)`, `vercel.json`, `apps/api/scripts/migrate-refund-index.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/mobile/app.json`, `DEPLOYMENT.md`

## COMPLIANCE-83 · P0 · Moderation, publication review and support are staffed at launch

*Surfaces:* admin, email  ·  *Type:* compliance

**Before:** A roster of named moderators and support staff.

**Steps:**

1. Confirm the named moderators, their schedule and backup cover.
2. Submit a 'child_safety' report outside business hours and measure time to acknowledgement.
3. Confirm escalation contacts (police, child protection) are documented.
4. Create a held comment and a held campaign in /publication-reviews and measure time to decision.
5. Measure support@ response time.
6. Walk through the appeal path.

**Expect:** Staffing supports the App Review claim that reports go to a staffed queue and new content is held for review. Response times are documented.

**Needs:** Staffing

**Source:** `docs/compliance/MODERATION_OPERATIONS.md`, `apps/mobile/APP_REVIEW_NOTES.md`, `apps/admin/src/pages/PublicationReviewsPage.tsx`

## COMPLIANCE-85 · P0 · No test data, test keys, seeded accounts or placeholder content in production

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Read-only production DB. Admin access.

**Steps:**

1. Search production users for admin@ujimora.com, amara2@ujimora.com and any *@ujimora.dev account created by the old seed scripts (the old seed-dev admin had a known password). Remove or disable them.
2. Search production campaigns and users for 'test', 'demo', 'e2e' and the seeded names from scripts/seed-e2e.mjs and seed-dev.mjs.
3. Confirm the seed scripts can no longer target a hosted or production database (COMPLIANCE-N005).
4. Review blog and site-content seeds (seedBlogIfEmpty, seedSiteContentIfEmpty) and the CMS About, FAQ and Contact pages, including the corrected FAQ wording (COMPLIANCE-07).
5. Confirm the Paystack keys in use are live and the admin Payment providers page shows live mode.
6. Ask owners who registered payout accounts before the live cutover to add them again: live payouts to a test-mode recipient are refused with 'This payout destination was registered in Paystack test mode. The owner must add the account again before it can be paid.'
7. Search the site and apps for 'Lorem', 'TODO', '<...>' and example.com.
8. Confirm no placeholders remain in the store notes.

**Expect:** Production contains only real, reviewed content, intended accounts and live configuration, and no seeded account with a known password.

**Needs:** None

**Source:** `apps/api/scripts/seed-e2e.mjs`, `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seedGuard.mjs`, `apps/api/src/main.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

## COMPLIANCE-N003 · P0 · Client IP resolution ignores spoofed forwarding headers for rate limits and the audit trail

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Production or a staging service behind Render's Cloudflare edge. curl. An admin account and audit-log access. Optionally an IPv6 connection.

**Steps:**

1. From one machine, send 31 POST /api/v1/auth/login requests (wrong password) to https://api.ujimora.com, each with a different forged X-Forwarded-For value. The 31st returns 429; forged values do not create new buckets.
2. Repeat in the same window rotating X-Real-IP, True-Client-IP and X-Vercel-Forwarded-For. Still 429.
3. Send CF-Connecting-IP: 203.0.113.9. Render's edge overwrites it, so the request is still counted against your real IP (still 429).
4. On IPv6, rotate source addresses within one /64 if possible. They share one bucket.
5. As admin, make a mutation while sending forged forwarding headers. The audit-log ip is your real public IP, not the forged value.
6. Compare X-RateLimit-Remaining between your machine and a second network. Each counts down independently.

**Expect:** The rate-limit identity and the mutation audit IP come only from CF-Connecting-IP (or the socket peer), forged forwarding headers have no effect, and IPv6 clients are grouped by /64. Finding to log: sign-in audit events (auth.admin_login.*) and consent events still store req.ip rather than the resolved client IP (AuthController.ts:97 and :115, profileRoutes.ts:112), so in production those records show a proxy address.

**Needs:** Two networks, IPv6 connection (optional)

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `apps/api/__tests__/integration/client-ip-rate-limit.integration.test.ts`, `DEPLOYMENT.md`

## COMPLIANCE-N008 · P0 · Account deletion API requires re-authentication and refuses while money is outstanding

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Staging accounts with bearer tokens: P (no balances, MFA off), Q (MFA on), R (wallet balance GHS 10), S (a payout in progress), T (an active campaign with zero balance plus a campaign in pending_review).

**Steps:**

1. GET /api/v1/profile/closure-check. P: canClose true, openCampaigns 0, blockers []. R: canClose false, message naming 'GHS 10.00 in your Ujimora wallet'. S: message naming '1 payout still being processed'. T: canClose true, openCampaigns 1 or more.
2. DELETE /api/v1/profile for P with no body. Expect 400 'Enter your current password to delete your account. If you are not asked for it, update the Ujimora app or delete your account from Settings at app.ujimora.com.' The account stays active.
3. DELETE with a wrong password. Expect 400 (not 401); the same access token still works for GET /profile.
4. For Q, send the password only. Expect 400 asking for an authenticator or recovery code. Password plus a valid code succeeds; a recovery code cannot be reused.
5. For R and S, send the correct password. Expect 409 with 'Your account can’t be closed yet. …' and errors.accountClosure listing the blocker kinds. Nothing is erased.
6. For T, send the correct password. It succeeds. The active campaign becomes expired (its end date never moves later) and the pending_review campaign becomes draft. Donations and ledger entries are unchanged.
7. Send 31 DELETE attempts from one client in 15 minutes. The 31st returns 429.

**Expect:** A stolen access token alone cannot close an account, funds cannot be stranded by deletion, open campaigns end instead of staying live, and older app builds get actionable guidance.

**Needs:** Authenticator app

**Source:** `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountClosureCheck.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/mobile/APP_REVIEW_NOTES.md`

## COMPLIANCE-03 · P1 · Supplier information is reachable from checkout, subscription and email surfaces (Electronic Transactions Act 772, ss.47-54)

*Surfaces:* email, marketing, web  ·  *Type:* compliance

**Before:** A test campaign exists. A signed-in test account has activity email enabled.

**Steps:**

1. Inspect the footers on app.ujimora.com and ujimora.com for the operator's legal name, address and contact.
2. Open /c/<slug>/donate and look, within one click, for the operator's identity and links to Terms, Refund policy and Privacy.
3. Open /subscription and check the same before purchase.
4. Trigger an email-verification email and an activity email, then inspect sender, footer and support contact.
5. Record any gaps for legal review.

**Expect:** The operator's legal name (DevTrack), contact email and address, and links to Terms, Refund policy and Privacy are reachable from checkout and subscription purchase. Emails identify the sender and a support contact. Current source shows only '(c) <year> Ujimora. All rights reserved.' in both footers (Footer.tsx). Log this as a legal-review item if counsel requires the operator identity there.

**Needs:** Resend for the email checks

**Source:** `apps/web/src/components/layout/Footer.tsx`, `apps/marketing/src/components/Footer.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/ResendActivityEmails.ts`

## COMPLIANCE-05 · P1 · Published legal and support mailboxes are live and monitored; the deletion mailto template works

*Surfaces:* android, email, ios, web  ·  *Type:* functional

**Before:** An external mailbox to send test messages from. Render dashboard read access to confirm the sender settings.

**Steps:**

1. Send a test message to info@, support@, legal@, trust@ and sales@ujimora.com.
2. In the Render dashboard, confirm FROM_EMAIL=no-reply@ujimora.com and REPLY_TO_EMAIL=support@ujimora.com. render.yaml now declares these values; an existing service needs a Blueprint sync or a manual dashboard edit to pick them up.
3. Trigger a transactional email (for example Settings > send a verification link). Confirm the sender is no-reply@ujimora.com and the email's support line shows support@ujimora.com.
4. Reply to that email and confirm the reply lands in the monitored support@ mailbox (not info@).
5. On /delete-account (web) and the native Delete-your-account screen, tap 'Request account and data deletion by email'.
6. Confirm the mail client opens addressed to legal@ujimora.com with subject 'Ujimora account and personal-data deletion request' and the body template.
7. On https://ujimora.com/contact, confirm the info@ channel is labelled 'Email us' (it no longer says 'Email support').
8. Record time to first human acknowledgement for each mailbox.

**Expect:** No bounces. Replies to transactional email reach support@ujimora.com, matching the legal pack. Each mailbox has a named owner and an agreed response time. The mailto is prefilled correctly on web, iOS and Android. If no mail client is available, native shows 'Unable to open link' with the legal@ address. Campaign review alerts and contact-form alerts still go to REVIEW_ALERT_EMAIL (info@ by default, or the admin Settings override), so that mailbox must also be monitored.

**Needs:** Mail hosting for ujimora.com, Resend, Render dashboard

**Source:** `packages/types/src/legal.ts (LEGAL_ENTITY.emails, delete-account actions)`, `apps/mobile/src/components/LegalScreen.tsx`, `render.yaml (FROM_EMAIL, REPLY_TO_EMAIL, REVIEW_ALERT_EMAIL)`, `apps/marketing/src/pages/ContactPage.tsx`

## COMPLIANCE-06 · P1 · Promises in legal copy are backed by real artifacts, or the copy is amended

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** Staging DB access. A legal reviewer is available. Build from integrate/launch-fixes (legal text amended; LEGAL_ACCEPTANCE_VERSION still 2026-09-12, effective date 8 September 2026).

**Steps:**

1. Terms section 15: confirm it now reads 'Earlier versions are available on request from legal@ujimora.com' (no public archive is promised). Email legal@ asking for the previous version and confirm someone can supply it.
2. Terms section 14: confirm it names support@ first, escalation to legal@ujimora.com, and privacy complaints in account Settings, with no claim of a 'documented complaint and escalation process'. Confirm legal@ has an owner for escalations.
3. Privacy section 7: confirm it says to contact legal@ujimora.com for the retention period that applies (no 'separate retention schedule' claim). Confirm legal@ can answer from the internal schedule (COMPLIANCE-31).
4. Privacy section 10 and the Cookie Notice: confirm both say no cookies, analytics or advertising technologies are used and the Cookie Notice lists the browser storage keys and lifetimes. Verify accuracy with COMPLIANCE-N012.
5. Organizer Agreement section 10: confirm it describes account-level acceptance (user ID, agreement version, timestamp) applying to each campaign while that version is current. Create a campaign on staging and confirm the creator has users.legalAcceptance plus a legal_acceptance_events record; no per-campaign acceptance record is expected.
6. Privacy 'Optional activity alerts and emails': confirm the new sentence that staff decisions on your campaigns, verification applications and reports appear in the notification inbox as service notices, and that such notices actually arrive (in-app only, no email).
7. Privacy section 5 still says Ujimora 'contractually governs its processors': obtain the list of signed DPAs.
8. Ask legal to confirm in writing that these wording changes do not require bumping LEGAL_ACCEPTANCE_VERSION or the effective date.

**Expect:** Each remaining promise has evidence: an owner at legal@ who can supply earlier versions, retention periods and escalation handling, and DPAs for processors. The amended text is identical on marketing, web and native (all bundled from packages/types/src/legal.ts). Legal has signed off the amended text and the decision to keep the agreement version is recorded.

**Needs:** Legal review

**Source:** `packages/types/src/legal.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLegalAcceptanceLog.ts`, `docs/compliance/DATA_RIGHTS.md`

## COMPLIANCE-13 · P1 · Consent record integrity and a version-bump drill

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A staging environment you can redeploy with a changed constant. Read access to users and legal_acceptance_events. An older native build installed on a device.

**Steps:**

1. POST /api/v1/profile/legal-acceptance twice for a current user. acceptedAt does not change on the second call and legal_acceptance_events gains no new document.
2. POST a body that includes an acceptedAt field. It is ignored and server time is stored.
3. Register a new account. users.legalAcceptance and one legal_acceptance_events document (source 'register', same version and acceptedAt, with ip and userAgent) are written together.
4. Staging only: bump LEGAL_ACCEPTANCE_VERSION and redeploy API and web. GET /profile/legal-acceptance returns current:false with the new requiredVersion. Web shows the agreement banner on sign-in or tab focus, publishing returns 428, and saving the agreement records the new version.
5. On the older native build, open the agreement screen. It shows 'An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.' with 'Review on the website' and 'I have accepted it, check again'. It never accepts terms the build does not contain.
6. Confirm an old client that still sends the old version to POST /profile/legal-acceptance or /auth/register gets 400.
7. After re-acceptance, query legal_acceptance_events for the user. The earlier 'register' (or 'backfill') event and the new 'reaccept' event are both present; nothing was overwritten.
8. Check the ip field on the register and reaccept events.

**Expect:** The record is server-stamped and clients cannot set timestamps. After a version bump every user is prompted again, and current native builds point users to an update or the website. Prior acceptances are kept as insert-only events (register, reaccept, backfill); users.legalAcceptance holds only the current state. Note for review: register and reaccept events store req.ip (AuthController.ts:97, profileRoutes.ts:112), not the resolved client IP the audit log uses, so in production the ip may be Render's proxy address. Log it if legal needs the client IP as evidence. Backfill and erasure survival are covered in COMPLIANCE-N006.

**Needs:** Staging redeploy, older native build

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLegalAcceptanceLog.ts`, `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `packages/types/src/legal-acceptance.ts`, `apps/mobile/app/account-agreement.tsx`, `apps/web/src/components/auth/AccountAgreement.tsx`

## COMPLIANCE-15 · P1 · Anonymous guest donation with no message: confirm the 18+ policy decision

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Staging with Paystack test keys. Tester signed out.

**Steps:**

1. On web /c/<slug>/donate, check 'anonymous' and leave the message empty. No age/terms checkbox is shown. Under the pay button the notice reads 'Donations are made under our Terms of Use, Contributor Terms and Privacy Notice. You must be 18 or older to donate.' Each link opens the right policy in a new tab. Checkout proceeds.
2. Repeat on Android donate/[id]. The same notice appears and the Terms of Use, Contributor Terms and Privacy Notice links open the native policy screens.
3. If crypto is enabled on staging, confirm the crypto donate panel shows the same notice.
4. POST /api/v1/donation-intents with no legalAcceptance, no message and isAnonymous true. It is accepted and the intent has no messageAgreement.
5. Ask legal whether this notice is enough, or whether Contributor Terms (minimum age 18) need an active checkbox and a stored record for every contribution, and whether the APP_REVIEW_NOTES wording is accurate.

**Expect:** Every donor sees the terms and 18+ notice next to the pay button on web (fiat and crypto) and Android. Behaviour matches a written legal decision; if legal requires active acknowledgement for every contribution, this is a launch blocker. Known open issue I086: the notice is informational only. No consent is recorded and the API still accepts anonymous no-message guest donations without acknowledgement (donationContentAgreement returns undefined).

**Needs:** Paystack test keys, legal decision

**Source:** `apps/web/src/components/donate/DonationTermsNotice.tsx`, `apps/web/src/pages/DonatePage.tsx`, `apps/mobile/app/donate/[id].tsx`, `apps/api/src/application/services/messageAgreement.ts`, `packages/types/src/legal.ts (contributor-terms)`

## COMPLIANCE-19 · P1 · Newsletter double opt-in, scanner-safe confirmation and withdrawal (Electronic Transactions Act s.50)

*Surfaces:* admin, android, email, ios, marketing, web  ·  *Type:* compliance

**Before:** Production or staging with Resend and AUTH_EMAIL_ENCRYPTION_KEY_BASE64 configured. A new email address.

**Steps:**

1. Subscribe from the ujimora.com newsletter form.
2. Receive the confirmation email. Load the /newsletter/confirm link without pressing the button and check the DB: status is still pending.
3. Press confirm. Status becomes active.
4. Signed out, open the unsubscribe link and press the button. Status becomes withdrawn.
5. Replay the unsubscribe. It returns success idempotently.
6. Toggle the newsletter preference in web and native Settings.
7. Send 21 subscribe requests in 15 minutes. The last returns 429.
8. Check admin /newsletter: only confirmed subscribers are listed.
9. Delete the test account. The subscription and consent records are cleaned up.

**Expect:** No subscription exists without explicit confirmation. Withdrawal works immediately and needs no login. No bulk sender is used without a consent recheck.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.ts`, `apps/web/src/pages/NewsletterConsentPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `docs/compliance/NEWSLETTER.md`

## COMPLIANCE-20 · P1 · Optional channels start off: activity alerts and the organization website request to Neurodyne

*Surfaces:* android, api, email, ios, web  ·  *Type:* compliance

**Before:** A new individual account and a new organization account. Resend configured.

**Steps:**

1. Open web Settings for the new account. Every activity category and channel is off. The email channel stays disabled until the email is verified.
2. Verify the email using the link sent automatically at signup ('Verify your Ujimora email address') and enable only 'donation confirmations' by email.
3. Make a test donation. Only that alert is delivered.
4. Turn the alert off with a message queued. The queued message is suppressed.
5. On organization signup, confirm the website request is unchecked by default and the privacy notice names Neurodyne Corp Ltd as recipient.
6. Check the website request, then use 'Withdraw website request'. The withdrawal persists after reload and a later profile save does not restore it.
7. List every email received after signup and donation. The only signup email is the transactional verification email; no marketing or newsletter email follows signup or donation.

**Expect:** Each channel is a separate opt-in with a server timestamp. Withdrawals take effect. Signup and donation imply no marketing consent; the automatic verification email is a transactional account email, not marketing.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts (website-request)`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts (verification email at signup)`, `docs/compliance/ACTIVITY_ALERTS.md`, `packages/types/src/legal.ts (privacy: website requests)`

## COMPLIANCE-22 · P1 · AI writing and automated screening require consent on every request, with no raw content retained

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** AI_WRITING_ENABLED=true and OPENAI_API_KEY set (production), or the staging equivalents.

**Steps:**

1. Open the AI assistant during campaign creation. The consent box is unchecked on every request.
2. Try to generate without consent. The UI blocks it.
3. POST /api/v1/ai-writing without consent. Expect a 4xx, and admin /ai-usage counts plus the OpenAI usage dashboard stay unchanged.
4. Generate with consent.
5. Submit clearly prohibited text. Expect a generic 422 and no draft returned.
6. Post a comment with publication-screening consent left unchecked. It is held for staff review, not sent to OpenAI.
7. Check admin /ai-usage shows no raw prompts or outputs.

**Expect:** Every transmission to OpenAI needs its own explicit consent. Screening fails closed and no raw text is stored. OpenAI processing is disclosed in the Privacy notice.

**Needs:** OpenAI

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/aiWritingRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiWritingProvider.ts`, `apps/api/src/infrastructure/adapters/outbound/ai/OpenAiContentModerator.ts`, `docs/compliance/AI_SAFETY.md`, `docs/compliance/PUBLICATION_REVIEWS.md`

## COMPLIANCE-25 · P1 · Data-rights request lifecycle (access, correction, complaint) on web, native and admin

*Surfaces:* admin, android, email, ios, web  ·  *Type:* functional

**Before:** User A (member) with a verified email and Resend configured. An admin account.

**Steps:**

1. As A on web Settings > 'Your data and privacy requests', submit an access request (details of at least 10 characters). Expect 'Request received. Check this section for its response.'
2. Submit a second access request. It is rejected because one unresolved request per kind is allowed.
3. Submit a correction and a complaint. Both are accepted.
4. Open native Settings and confirm the same three requests appear.
5. In admin /privacy-requests, confirm the queue is sorted by target date (submission + 30 days). Record internal evidence and publish a response with in-account delivery.
6. Check A's inbox: exactly one email, subject 'Your Ujimora privacy request has a response', giving the reference and directing A to Settings > 'Your data and privacy requests'. It contains none of the response content.
7. As A, read the response in Settings. Download the JSON on web ('Download request and response'); use the share sheet on native.
8. Publish another response with verified external delivery. No email is sent for that one.
9. Send 21 requests within 15 minutes from one client. The last returns 429.

**Expect:** The flow works end to end with a fixed target date. Internal evidence is never shown to the requester. The only email is a content-free 'response ready' notice for in-account delivery. Audit events are recorded.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts (data_rights_response)`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/web/src/components/account/DataRightsRequests.tsx`, `apps/mobile/src/components/DataRightsRequests.tsx`, `docs/compliance/DATA_RIGHTS.md`

## COMPLIANCE-28 · P1 · Deletion retries, historical closure audit and the email-only deletion path

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Staging. Read-only production MongoDB credentials. umask 077 on the operator machine. An admin with USERS delete permission.

**Steps:**

1. On staging, make the erasure step fail (for example with a temporarily invalid provider credential). Request deletion. The request stays pending and admin sees retry state.
2. Restore the credential. The next sweep (every 60 s in production, also at boot) completes it.
3. From apps/api, run npx tsx scripts/audit-account-closure.ts <cutoff at least 30 min old> against production, paging with nextCursor until it is null.
4. Triage any exit-2 findings. Keep the reports out of Git.
5. Drill: send a deletion request email to legal@ from a registered address. Staff verify ownership (for example a reply from the registered address).
6. In admin, open the member's detail page > 'Account closure' > 'Close account'. Enter how the request was verified (at least 20 characters), type the account email and confirm.
7. Confirm the member's sessions end, an erasure request appears in /privacy-requests, and the audit log has 'account.staff_closure' with the verification note. If the member holds a balance or a payout in progress, the console shows the 'Your account can’t be closed yet…' refusal and staff resolve the funds first.
8. Reply to the requester within the agreed time.

**Expect:** Retries are idempotent. The audit ends with exit 0 or documented triage. The email path has an owner and a time target, and staff close accounts through the console (not database edits) with a recorded verification note. Detailed control tests and a merge risk found while updating this plan are in COMPLIANCE-N007. Known open issue I083: there is no staff-assisted email change and no written identity-verification runbook.

**Needs:** MongoDB Atlas read-only user

**Source:** `apps/api/scripts/audit-account-closure.ts`, `docs/compliance/ACCOUNT_CLOSURE_AUDIT.md`, `apps/api/src/app.ts (erasureTimer)`, `apps/api/src/main.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/admin/src/components/AccountClosureControl.tsx`

## COMPLIANCE-31 · P1 · Retention schedule approved per category and TTL indexes present in production

*Surfaces:* api  ·  *Type:* compliance

**Before:** Legal and accountant input. Read-only production DB.

**Steps:**

1. Review the DATA_RIGHTS.md retention table with counsel: tokens, newsletter, profile, financial/KYC/AML (Act 1044 record-keeping), privacy/safety/audit logs, provider receipts, live/media, and Render/Vercel logs.
2. Add the collections introduced by the launch fixes: legal_acceptance_events (insert-only consent history, kept after erasure), revoked_sessions (8-day TTL), providerpaymentevents (dispute and refund evidence), content restriction events, account email jobs including data_rights_response, and contact-form messages copied into the staff mailbox by email.
3. In production, run getIndexes() on the password-reset and email-verification token collections and on revoked_sessions. Confirm TTL indexes exist (revoked_sessions: expiresAt with expireAfterSeconds 0).
4. Privacy section 7 now tells users to contact legal@ujimora.com for the retention period that applies. Confirm legal@ can answer from the approved schedule.
5. Confirm a legal-hold procedure exists.

**Expect:** A signed retention schedule covers every category, including the new collections, and TTL indexes are present. No category is retained indefinitely without justification (consent events are kept as evidence). Known open issue I084: the KYC retention job, Paystack transfer-recipient deletion and test-data flags on money records are not implemented.

**Needs:** Legal, MongoDB Atlas

**Source:** `docs/compliance/DATA_RIGHTS.md`, `packages/types/src/legal.ts (privacy section 7)`, `apps/api/src/infrastructure/database/models/RevokedSessionModel.ts`, `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/api/src/infrastructure/database/models/ProviderPaymentEventModel.ts`

## COMPLIANCE-32 · P1 · On-device data protection: logout cleanup, backup exclusion, app-switcher privacy

*Surfaces:* android, api, ios  ·  *Type:* compliance

**Before:** Signed release builds on physical devices. A second Android device for the transfer test. A proxy to capture the refresh token.

**Steps:**

1. Sign in, start an Android donation to leave a pending-payment record, then log out.
2. Relaunch. The app is signed out and shows no prior name or pending checkout from the old account.
3. Replay the captured refresh token to POST /api/v1/auth/refresh. It returns 401 'Invalid or expired refresh token', because logout revoked the session through POST /auth/logout (see COMPLIANCE-N009).
4. On Android, trigger a Google backup and a device-to-device transfer to the second phone. The app has no data and no session there (allowBackup=false plus the extraction rules).
5. On iOS, with and without biometric lock enabled, background the app and open the app switcher. The branded privacy cover hides the content.
6. On Android, open Recents while a KYC or wallet screen is showing and note whether content is visible.
7. In KYC, pick ID images with the camera and gallery, force-kill the app, relaunch, and confirm <cache>/ImagePicker and <cache>/DocumentPicker no longer hold files from before the launch (adb run-as or a debug file browser).
8. Enable biometric unlock and move past 7 days since enabling it or the last password sign-in. Unlock reports that biometric unlock has expired and asks for the password; Settings discloses the 7-day limit.
9. Reinstall on iOS and check that no session is silently restored from Keychain, or that the behavior is documented.

**Expect:** No credentials or personal data remain on the device after logout, and the refresh session is revoked on the server. Backups and device transfers exclude app data. iOS app-switcher snapshots are covered for every user. KYC picker copies are removed at the next launch. Known open issue I106: Android Recents thumbnails and screenshots are not blocked (no FLAG_SECURE), and the privacy cover is not shown on Android window blur.

**Needs:** Physical devices, proxy tool

**Source:** `apps/mobile/app.json (allowBackup)`, `apps/mobile/plugins/withPrivateBackupRules.js`, `apps/mobile/src/lib/session.ts`, `apps/mobile/src/components/PrivacyCover.tsx`, `apps/mobile/src/lib/uploadCache.ts`, `apps/mobile/src/lib/unlockError.ts`, `docs/compliance/NATIVE_PERMISSIONS.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## COMPLIANCE-41 · P1 · KYC review integrity: self-review, concurrent decisions, duplicate submissions, Request More, renewal window

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging. Two admins. One admin with their own pending KYC. An applicant with a pending KYC. An applicant whose approval expires more than 30 days from now.

**Steps:**

1. The admin tries to approve their own KYC. It is denied.
2. Two admins approve and reject the same record at the same moment. One succeeds, one returns 409, and there is one audit entry.
3. One user submits identity KYC twice concurrently. One returns 201 and one 409.
4. In admin, click 'Request more information', enter a prompt of 20 to 2,000 characters and save. The status becomes in review, the request appears in the history, and approval and repeat requests are disabled while it is unanswered. The applicant sees the request in /kyc and gets an in-app notice (no email). After the applicant replies, 'Refresh queue' shows the reply and approval becomes possible.
5. Approve, reject or request info with a stale reviewVersion after another admin changed the record. Expect 409 asking to refresh; with no version, expect 428.
6. The applicant whose approval expires in more than 30 days submits identity KYC again. Expect 409 'Your identity verification is current. You can renew it from <YYYY-MM-DD>, 30 days before it expires.' The web KYC card does not invite an early update.
7. Submit KYC referencing another user's document ID. It is rejected.

**Expect:** Every race resolves to a single committed decision. Request More is persistent and visible to the applicant. An early renewal cannot suspend a current approval, and no false status is shown.

**Needs:** None

**Source:** `docs/compliance/KYC_REVIEW_INTEGRITY.md`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`, `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/api/src/application/use-cases/SubmitKYCIdentityUseCase.ts`, `apps/api/src/domain/services/currentKycEvidence.ts`

## COMPLIANCE-43 · P1 · Donation confirmation and receipt promises match what is actually emailed

*Surfaces:* android, email, web  ·  *Type:* compliance

**Before:** Paystack test keys. A guest email inbox. A signed-in donor account.

**Steps:**

1. Donate as a guest (no account) and list every email received. Expect only Paystack's own receipt; Ujimora sends none to guests.
2. Open https://app.ujimora.com/donate/callback with no reference. The message reads 'We couldn't find a payment reference to confirm. If money left your account, don't pay again. Keep any receipt from Paystack or your bank or mobile money provider, and email support@ujimora.com with the reference so we can check it.'
3. If crypto is enabled on staging, confirm the crypto donate panel's email prompt makes no receipt promise.
4. As a signed-in donor with activity email off, donate and list the emails received (none from Ujimora). Turn on donation confirmations by email and donate again: 'Your donation is confirmed' arrives.
5. Search web, native and marketing copy for 'receipt is emailed', 'email you a receipt' and 'receipt will be sent'.

**Expect:** No UI promises an Ujimora-emailed receipt to donors who will not get one. Guests rely on the Paystack receipt, and opted-in account holders get the activity email. Known open issue I051 (product decision): no transactional receipts or purchase confirmations are sent by default.

**Needs:** Paystack test keys, Resend

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/web/src/components/donate/CryptoDonatePanel.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## COMPLIANCE-46 · P1 · Payout and refund fees: disclosed amount equals recorded amount and matches the published policy

*Surfaces:* admin, android, api, web  ·  *Type:* compliance

**Before:** Staging. An owner with an eligible GHS balance of at least 2,000. Paystack test transfers.

**Steps:**

1. Request payouts of GHS 1,000 and check fee and net before confirming: priority fee 10 (0.5%, min 10), net 990; early 20; urgent 30; assisted 65 (1.5% + 50).
2. Confirm the recorded payout fee and net match what was disclosed.
3. Change payout fees in admin Settings after a quote. The existing payout keeps its fee, or reconfirmation is required.
4. If a non-GHS campaign exists, check that GHS minimum fees are not applied as raw numbers in another currency (open issue in REFUNDS_AND_FEES.md).
5. Submit a refund request. It says 'Submitting is free', gives no timing guarantee, shows the correct currency and records the full amount with fee 0.

**Expect:** The disclosed fee equals the recorded fee, and render.yaml values match the published Payout & Refund policy.

**Needs:** Paystack test transfers

**Source:** `render.yaml (PAYOUT_*)`, `apps/api/src/infrastructure/config/index.ts`, `apps/web/src/pages/RefundRequestPage.tsx`, `docs/compliance/REFUNDS_AND_FEES.md`, `packages/types/src/legal.ts (refund-policy)`

## COMPLIANCE-48 · P1 · Crypto safety rails: no mock provider in production, admin-only recovery, enablement checklist

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A staging instance you can start with NODE_ENV=production.

**Steps:**

1. Start the API with NODE_ENV=production, CRYPTO_PAYMENTS_ENABLED=true and CRYPTO_PRIMARY_PROVIDER=mock. Startup fails with 'Unknown or unsafe CRYPTO_PRIMARY_PROVIDER'.
2. In production, POST a forged mock-signed event to /api/v1/webhooks/crypto. It is rejected.
3. As admin, POST /api/v1/admin/crypto/reconcile with intake off. It works.
4. As a non-admin, call the same endpoint. Expect 403.
5. Send body {olderThanMinutes:-1}. Expect 400.
6. Before any future enablement, complete the CRYPTO_RELEASE_GATES checklist: Act 1154 VASP registration/licence evidence, Bitnob contract, quote/network/refund disclosures, sandbox acceptance.

**Expect:** The unsafe configuration cannot start and recovery is admin-only. Any future enablement is gated by documented evidence.

**Needs:** Bitnob sandbox (only for future enablement)

**Source:** `apps/api/src/app.ts (crypto provider map)`, `apps/api/src/infrastructure/adapters/inbound/http/routes/cryptoAdminRoutes.ts`, `docs/compliance/CRYPTO_RELEASE_GATES.md`

## COMPLIANCE-58 · P1 · Runtime permissions are requested in context, with working denial paths

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Fresh installs of signed builds.

**Steps:**

1. Launch the app. No permission prompt appears at startup.
2. In KYC, tap Take photo. The camera prompt shows the purpose string. Deny it; the system picker fallback works with no broad media permission requested.
3. Tap 'Use my location'. A when-in-use prompt appears. Deny it and enter the address manually. Allow it and confirm a single fix with no ongoing location indicator.
4. Go live. Camera and microphone prompts appear. Deny the microphone and confirm the message is clear.
5. Enable biometric lock. The Face ID prompt shows its purpose string.
6. Revoke each permission in OS settings and retry each flow.

**Expect:** Permission prompts appear only in context (Apple 5.1.1(iv), Play permissions policy). Every denial path still lets the user finish the task.

**Needs:** Physical devices

**Source:** `apps/mobile/app.json (plugins permission strings)`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/kyc.tsx`, `docs/compliance/NATIVE_PERMISSIONS.md`

## COMPLIANCE-61 · P1 · Live-broadcast safety against the real LiveKit Cloud deployment

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET for LiveKit Cloud (token revocation is Cloud-only). A host account, a signed-in viewer A and an anonymous viewer.

**Steps:**

1. The host starts a live session. Viewer A and the anonymous viewer join.
2. The host blocks A. A is disconnected and cannot rejoin or obtain a new token.
3. A moderator stops the stream from its safety report. The host is evicted, the room closes, and a token refreshed after the cutoff fails.
4. Delete the host account while live. The room is cleaned up.
5. On staging, remove the LiveKit credentials. Cleanup stays pending (not marked clean) and admin offers Retry.
6. Confirm LiveKit recording is disabled or its retention is covered by contract.

**Expect:** Token revocation works on LiveKit Cloud. Cleanup failures stay visible and can be retried.

**Needs:** LiveKit Cloud

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.ts`, `apps/api/src/app.ts (live safety timer)`, `docs/compliance/MODERATION_OPERATIONS.md`, `docs/live-broadcasting.md`

## COMPLIANCE-65 · P1 · MFA is available and every admin account is known, prompted to use MFA and audited at sign-in

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Read-only production DB. Access to the admin accounts. The App Review demo account.

**Steps:**

1. Authenticated: GET /api/v1/auth/mfa. Expect available:true, which means MFA_ENCRYPTION_KEY is valid.
2. Sign in to the admin console as an admin without MFA. Every page shows 'Protect this administrator account: turn on authenticator app sign-in. A stolen password alone would give full access to donor data and payouts.' with 'Turn on' linking to Profile > Security. If the server has no MFA key, the banner instead says 'Administrator accounts should use authenticator sign-in, but it is not configured on this server yet. Ask engineering to set it up.'
3. Enable an authenticator on each admin. Sign-in then requires a code, a recovery code works exactly once, and the banner disappears.
4. Query production for users with role 'admin'. Confirm each is an intended staff member with MFA on. Remove test or demo admins, including admin@ujimora.com or *@ujimora.dev accounts created by old seed scripts.
5. In the audit log (resource 'account-security'), confirm events for the steps above: auth.admin_login.succeeded, auth.admin_login.failed (wrong password; rejected authenticator code) and auth.admin_console.refused.
6. Sign in to the admin console with the App Review demo account. It is refused with 'This account does not have staff access.' and its role is user.

**Expect:** MFA is available, only intended staff hold admin, every admin uses MFA, and administrator sign-ins and failures are audited. Known open issue I028: MFA is not enforced for admins, there is no per-account lockout (only the per-client auth limit), and these sign-in audit events store req.ip, which in production is a proxy address rather than the client IP.

**Needs:** Authenticator app

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/admin/src/components/layout/AdminMfaPrompt.tsx`, `apps/admin/src/context/AuthContext.tsx`, `docs/compliance/STAFF_ACCESS.md`, `DEPLOYMENT.md`

## COMPLIANCE-72 · P1 · Per-endpoint rate limits return 429 correctly; live reads have their own bucket; webhooks are exempt

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging. A load tool. Two member accounts that can share one network.

**Steps:**

1. Exceed each limit from one client and confirm a 429 JSON response {message:'Too many requests, please try again later', status:429} with Retry-After, X-RateLimit-Limit and X-RateLimit-Remaining: general 300 per 15 min; auth (register, login, forgot, reset, MFA setup/enable/change, email-verification send/confirm, and DELETE /profile) 30; donation intent create/attempt and tip create/verify 60; newsletter 20; contact 10; safety reports 20; data rights 20; store billing 40.
2. Per-user buckets: payout destination registration (payout accounts, campaign and affiliate payout recipients) 20 per signed-in user; admin transfer controls (OTP authorize/resend/refresh) 30 per admin; subscription verify 120 per signed-in member. Confirm a second member on the same network is not affected when the first is throttled.
3. From one IP, poll GET /api/v1/live-sessions/:id/public (or keep the watch page open) past 300 requests in 15 minutes. It keeps returning 200 (live-read bucket of 1,800), and a POST from the same IP still has its general budget.
4. Send 400 signed test events to /api/v1/webhooks/paystack. None are throttled by the API limiter.
5. Note that /api/v1/auth/refresh and /api/v1/auth/logout sit only under the general limit.
6. Check the UIs: web forgot-password shows 'Too many attempts. Please wait about 15 minutes and try again.'; the subscription callback stops polling on 429 and disables 'Keep checking' for 60 s; other web and native screens show a readable message.

**Expect:** Each limit behaves as coded, keyed per client IP (IPv6 grouped by /64) or per user where stated, and live viewers do not consume the general budget. Known open issue I099: the in-memory limiter resets on every deploy or restart and is not shared across instances, so keep one instance.

**Needs:** Paystack test signature

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts`, `apps/api/src/app.ts`, `apps/web/src/pages/ForgotPasswordPage.tsx`

## COMPLIANCE-73 · P1 · Security headers on the API and frontends; admin cannot be framed; UGC is XSS-safe

*Surfaces:* admin, api, marketing, web  ·  *Type:* security/permission

**Before:** curl. A test HTML page on another origin for the iframe test. A signed-in test account. Vercel project settings access.

**Steps:**

1. Run curl -sI https://api.ujimora.com/health. Expect HSTS, X-Content-Type-Options: nosniff, frame protection, Referrer-Policy, no X-Powered-By, and X-Robots-Tag noindex.
2. Run curl -sI on https://app.ujimora.com/, https://admin.ujimora.com/, https://ujimora.com/ and a deep path such as /c/<slug> and /login. Expect X-Frame-Options (SAMEORIGIN on app and marketing, DENY on admin), Content-Security-Policy frame-ancestors ('self' on app and marketing, 'none' on admin), X-Content-Type-Options: nosniff and Referrer-Policy: strict-origin-when-cross-origin. /api/* paths are excluded on purpose.
3. Check which vercel.json each Vercel project uses. The repo-root vercel.json (which also builds the web app) has no headers block, so if app.ujimora.com is deployed from the repo root the headers will be missing.
4. Embed https://admin.ujimora.com and an app.ujimora.com page in iframes on a test page. Both are blocked. The web broadcast studio's overlay preview still works.
5. Scan all three sites with Mozilla Observatory or securityheaders.com and record the missing full CSP and Permissions-Policy as a risk acceptance item.
6. Enter <img src=x onerror=alert(1)> in a campaign title, comment, donor message and creator bio. Each renders as inert text.

**Expect:** The admin console cannot be framed, app and marketing frame only themselves, nosniff and Referrer-Policy are present, and no injected script executes. Known open issue I031: there is no full CSP (only frame-ancestors), no Permissions-Policy, HSTS is left to Vercel's default, and web and admin still keep tokens in localStorage, so UGC XSS safety remains critical.

**Needs:** Vercel project settings

**Source:** `apps/api/src/app.ts`, `vercel.json`, `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `apps/web/src/context/AuthContext.tsx`, `apps/admin/src/context/AuthContext.tsx`

## COMPLIANCE-76 · P1 · Dependency and supply-chain audit on the release commit

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* security/permission

**Before:** A clean checkout of the release commit. npm 12.0.2.

**Steps:**

1. Run npm ci, then npm run test:dependency-security. It passes.
2. Run npm audit --omit=dev --json and compare with the baseline in DEPENDENCY_SECURITY.md: 9 entries (5 moderate, 4 high, 0 critical), all in the two patched chains. Any new high or critical blocks release.
3. Confirm the Render build uses the pinned npm (render.yaml buildCommand: npx --yes npm@12.0.2 ci).
4. Read the Vercel build logs for web, admin and marketing. Record the npm version and confirm the postinstall apply-security-patches step ran. The vercel.json installCommand is still 'npm install' with the build image's npm.
5. Run Expo Doctor. Expect 20/20.
6. Confirm GitHub CI is green on the release commit (Render now deploys only after checks pass).

**Expect:** No unreviewed high or critical findings remain, builds include the security patches, and the Render build is reproducible. Known open issue I034: Vercel still installs with 'npm install' and npm 10; DEPLOYMENT.md gives the replacement command ('cd ../.. && npx --yes npm@12.0.2 ci') to apply once the Vercel Node version is confirmed.

**Needs:** npm registry, Vercel, GitHub Actions

**Source:** `package.json`, `scripts/dependency-security.test.cjs`, `scripts/apply-security-patches.cjs`, `docs/compliance/DEPENDENCY_SECURITY.md`, `vercel.json`, `render.yaml`, `DEPLOYMENT.md`, `.github/workflows/ci.yml`

## COMPLIANCE-78 · P1 · Monitoring, alerting and scheduled-job health

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** An uptime/log monitoring tool. A staging instance where DB access can be cut.

**Steps:**

1. Set an uptime monitor with alerting on https://api.ujimora.com/health/ready (503 {status:'unavailable'} unless MongoDB answers a ping within 2 s). /health stays liveness only.
2. On staging, block DB access. /health/ready returns 503 while /health stays 200, Render stops routing (about 15 s) and restarts the instance (about 60 s), and the monitor alerts. Restore access and /health/ready returns 200.
3. Create alert rules for these log messages: 'scheduled reconciliation failed', 'scheduled payout reconciliation failed', 'wallet top-up reconciliation failed', 'Account erasure sweep failed', 'Store billing sweep failed; durable work remains queued', 'Live safety reconciliation failed', 'notification outbox retry failed', 'Campaign expiry sweep failed', 'Production capabilities disabled by missing configuration', 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review', the fatal lines 'Unhandled promise rejection; exiting' and 'Uncaught exception; exiting', and the alert fields provider_dispute ('paystack reported a payment dispute — needs staff attention') and late_success_credited.
4. On staging, trigger an unhandled rejection and confirm the fatal log line followed by a Render restart.
5. Define a daily check of admin action-center counts: pending safety reports, pending campaign reports, refund requests (pending and processing), privacy requests, store billing review, live cleanup, crypto issues, refund recovery.
6. After a deploy, confirm the boot sweep log lines appear.
7. Enable Render deploy-failure notifications. Record Render's log retention period and check it matches the retention schedule.

**Expect:** A named owner is alerted within minutes of an API or database outage, a crash, a failed job or a provider dispute. Known open issue I035: there is no error tracking (Sentry or similar) and no built-in alerting on reconciliation failures, so alerting depends on these external log and uptime rules.

**Needs:** Monitoring provider

**Source:** `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/api/src/infrastructure/database/connection.ts (isDatabaseReady)`, `apps/api/src/infrastructure/logging/processFailureHandlers.ts`, `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/admin/src/pages/DashboardPage.tsx`, `DEPLOYMENT.md (Health checks and monitoring)`

## COMPLIANCE-80 · P1 · Incident response tabletop covering breach, key leak, bad deploy, fraud and admin takeover

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Owner, engineer and privacy lead available.

**Steps:**

1. Paystack secret leaked: rotate it in Paystack and Render, redeploy, and confirm webhooks still verify.
2. KYC document exposure: contain it (Cloudinary invalidation), assess it, notify the DPC and users as required, and handle it through legal@.
3. The API will not start after a deploy (see RENDER_STARTUP_INCIDENT.md; boot guards such as missing CORS_ORIGINS now stop a start on purpose): roll back and fix forward. Pushes deploy only after CI passes; use Manual Deploy for the fix.
4. A fraudulent campaign is collecting money: block it (payout requests and approvals then return 409), reject pending payouts with a recorded reason, and decide on refunds. Disputes are opened only by Paystack chargeback events, not by staff.
5. An admin account is taken over: demote the account, change its password (ending its sessions), rotate JWT secrets if the signing key may be exposed, and review the audit log for auth.admin_login.succeeded, auth.admin_login.failed and auth.admin_console.refused events and for that admin's mutations and payout approvals.
6. Confirm there is a contact tree, on-call rota, message templates and a vulnerability-disclosure contact.

**Expect:** A written runbook exists with an owner and a time target for each scenario, using the controls that now exist (campaign block, payout rejection, staff sign-in audit, CI-gated deploys). Known open issue I028: no security.txt or published vulnerability-disclosure contact exists under apps/*/public, and sign-in audit events record a proxy address rather than the client IP.

**Needs:** None

**Source:** `docs/compliance/RENDER_STARTUP_INCIDENT.md`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`, `docs/compliance/LOGGING_PRIVACY.md`, `docs/compliance/STAFF_ACCESS.md`, `apps/admin/src/pages/DisputesPage.tsx`, `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/LoginUserUseCase.ts`

## COMPLIANCE-81 · P1 · Load and performance smoke test on staging with a money-integrity check afterwards

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Staging on the same plan as production. k6 or artillery. Paystack test keys. Rate limits are now per client IP (CF-Connecting-IP): one load-generator IP gets 429 after 300 general requests, 1,800 live-read requests or 60 donation-intent creates per 15 minutes. Spread load across source IPs, or plan to measure only admitted requests.

**Steps:**

1. Ramp to 100 virtual users over 5 minutes on campaign list, campaign detail, slug preview and leaderboard, spread across source IPs.
2. Create 50 concurrent donation intents with distinct idempotency keys, plus a burst of 200 signed test webhooks that includes duplicates.
3. Hold a live session with 200 SSE viewers for 10 minutes.
4. Monitor p95 latency (target under 1 s for reads, under 2 s for writes), error rate excluding expected 429s (under 1%), instance memory and Mongo connections.
5. Record every 429 with its source IP and confirm it came only from a source that exceeded its own budget.
6. Afterwards, run audit-donation-settlement on staging.
7. Run Lighthouse (mobile profile) on / and /c/<slug>.

**Expect:** Latency and error targets are met. 429s appear only for a source that exceeded its per-client budget and never for other clients. There are no duplicate credits and the ledger balances. No request hits the 30 s server.requestTimeout.

**Needs:** Paystack test keys, load tool

**Source:** `apps/api/src/main.ts`, `apps/api/scripts/audit-donation-settlement.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/clientIp.ts`

## COMPLIANCE-84 · P1 · Read-only production integrity audits and index checks before launch

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Read-only Atlas credentials. umask 077.

**Steps:**

1. Run audit-donation-settlement.ts and audit-account-closure.ts with a cutoff at least 30 minutes old, paging until nextCursor is null.
2. Store the reports in restricted storage and triage every exit-2 finding.
3. Audit historical SUCCEEDED Paystack subscription checkouts (STORE_BILLING.md 'Web settlement recovery').
4. Verify the unique donationId_1 index on refunds (see RENDER_STARTUP_INCIDENT.md) and the token TTL indexes.
5. Earlier production audit attempts timed out on connectivity (HISTORICAL_DONATION_AUDIT.md). Resolve that first.

**Expect:** Every finding is resolved or has a documented remediation before launch.

**Needs:** MongoDB Atlas

**Source:** `apps/api/scripts/audit-donation-settlement.ts`, `apps/api/scripts/audit-account-closure.ts`, `docs/compliance/HISTORICAL_DONATION_AUDIT.md`, `docs/compliance/RENDER_STARTUP_INCIDENT.md`

## COMPLIANCE-88 · P1 · Organization 'Verified' labels and public identity do not overstate verification

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** Organization accounts at identity level only and at institutional level 3. One organization with expired verification.

**Steps:**

1. View each organization profile on web and native.
2. Only the level 3 organization shows 'Verified Organization'.
3. The expired organization shows no badge.
4. Call GET /api/v1/organizations/:slug. No login email is exposed.

**Expect:** The badge appears only for current institutional verification, and no private contact data is exposed.

**Needs:** None

**Source:** `docs/compliance/READINESS.md (store-review hardening)`, `docs/compliance/ACCOUNT_PUBLICATION.md`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`

## COMPLIANCE-N001 · P1 · Readiness endpoint /health/ready reflects MongoDB and drives Render's health check

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Production URL. A staging API whose MongoDB access you can block and restore. Render dashboard access.

**Steps:**

1. Run curl -si https://api.ujimora.com/health/ready. Expect 200 {status:'ok', timestamp} with Cache-Control: no-store and no database host, name or version in the body or headers.
2. Run curl -s https://api.ujimora.com/health. Expect 200 {status:'ok'} (liveness only, no DB check).
3. Send 400 requests to /health/ready within a minute from one IP. None return 429 (the endpoint is outside the /api/v1 limiter).
4. On staging, block MongoDB network access. /health/ready returns 503 {status:'unavailable'} within about 2 s per call, while /health stays 200.
5. Simulate a hung database (for example pause the DB container). /health/ready answers 503 after about 2 s instead of hanging.
6. In Render, confirm routing stops after about 15 s of failed checks and the instance restarts after about 60 s.
7. Restore DB access. /health/ready returns 200 again without a redeploy.
8. Confirm the Render service settings show Health Check Path /health/ready (from render.yaml after a Blueprint sync).

**Expect:** Readiness follows database availability, liveness stays independent, neither endpoint exposes internals, and readiness is never rate-limited, so Render and uptime monitors can act on it.

**Needs:** Render, staging MongoDB

**Source:** `apps/api/src/app.ts (/health, /health/ready)`, `apps/api/src/infrastructure/database/connection.ts (isDatabaseReady)`, `render.yaml (healthCheckPath)`, `DEPLOYMENT.md (Health checks and monitoring)`, `apps/api/__tests__/integration/health.integration.test.ts`

## COMPLIANCE-N002 · P1 · Production boot guards refuse unsafe configuration and name disabled capabilities without leaking values

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** A staging Render service (or local run) with NODE_ENV=production that you can restart with changed environment variables. Log access.

**Steps:**

1. Unset CORS_ORIGINS (or set it to ','). The API refuses to start: 'CORS_ORIGINS is required in production (comma-separated browser origins)'. Restore it.
2. Remove AUTH_EMAIL_ENCRYPTION_KEY_BASE64. The API starts and logs one error 'Production capabilities disabled by missing configuration' listing 'account email (password reset, email verification, newsletter confirmation, password-changed notices): needs RESEND_API_KEY, FROM_EMAIL, AUTH_EMAIL_ENCRYPTION_KEY_BASE64 (32 bytes, base64) and an https PUBLIC_WEB_URL'. Forgot-password shows the unavailable message. Restore it.
3. Remove MFA_ENCRYPTION_KEY. The same error lists 'authenticator MFA enrollment: needs MFA_ENCRYPTION_KEY (32 bytes, standard base64)'; GET /api/v1/auth/mfa reports available:false and the admin console shows the 'not configured on this server yet' banner. Restore it.
4. Leave STORE_BILLING_ENABLED unset. A warning 'Optional production capabilities are off' lists native store billing. Set STORE_BILLING_ENABLED=true with one APPLE_IAP_* key missing: the API refuses to boot.
5. With PAYOUT_DUAL_APPROVAL_AMOUNT=0, a warning explains that maker-checker is off and lists the compensating controls. Set it to 1000 and the warning disappears.
6. Unset OPENAI_API_KEY. An error 'OPENAI_API_KEY missing: publication screening disabled; opted-in submissions go to staff review' appears, and an opted-in comment lands in the publication review queue.
7. Set MIN_APP_VERSION_IOS=1.x. Boot fails with 'MIN_APP_VERSION_IOS must be a numeric app version such as 1.2.0'. Set APP_STORE_URL_IOS=http://example.com. Boot fails with 'APP_STORE_URL_IOS must be an https:// store URL'.
8. Search all of these logs for any secret value (keys, connection strings, tokens). None appear.

**Expect:** Unsafe configurations stop the process at boot. Degraded capabilities are announced once at startup by name only, never by value. The production launch deploy shows none of the fault lines.

**Needs:** Staging service with editable env

**Source:** `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/capabilities.ts`, `apps/api/src/infrastructure/config/payoutControls.ts`, `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/app.ts`, `DEPLOYMENT.md`

## COMPLIANCE-N004 · P1 · Web and admin call the API origin directly; legacy rewrite, marketing and Vercel previews behave as documented

*Surfaces:* admin, api, marketing, web  ·  *Type:* functional

**Before:** Production deploys of web, admin and marketing. Vercel project settings access. Two networks.

**Steps:**

1. In the Vercel web and admin projects, confirm no Production-scoped VITE_API_URL overrides .env.production (which sets https://api.ujimora.com/api/v1). If previews should work, confirm a Preview-scoped VITE_API_URL=/api/v1.
2. On app.ujimora.com and admin.ujimora.com, use DevTools Network: API calls go to https://api.ujimora.com/api/v1 with an Origin header and get Access-Control-Allow-Origin for that origin. Sign-in, donation checkout, image upload, live SSE events and the OBS overlay URL all work.
3. Search the built web and admin bundles for relative '/api/v1' fetches that bypass VITE_API_URL (the admin .env notes a few pages still use it). List them; they go through the rewrite and share the Vercel egress IP bucket.
4. Open a Vercel preview deployment (*.vercel.app). With the Preview override it works through the rewrite; without it, CORS blocks API calls. Confirm Deployment Protection covers previews, since they reach the production API.
5. The marketing site still uses the rewrite (apps/marketing/.env.production VITE_API_URL=/api/v1). From two different networks, submit the contact form 6 times each within 15 minutes. If the combined 11th submission returns 429, marketing visitors share one bucket per Vercel egress IP. Repeat for newsletter signup (20) and note whether CMS, blog or testimonial reads ever return 429 (general 300).

**Expect:** The donor app and staff console reach the API origin directly, so limits and audit use each browser's own IP. Previews either work through the rewrite or are protected. Shared-bucket behavior on the marketing site is measured and either accepted in writing or fixed (for example by pointing marketing at the API origin).

**Needs:** Vercel, two networks

**Source:** `apps/web/.env.production`, `apps/admin/.env.production`, `apps/marketing/.env.production`, `apps/marketing/src/pages/ContactPage.tsx`, `apps/marketing/src/components/NewsletterSignup.tsx`, `apps/web/vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `DEPLOYMENT.md`

## COMPLIANCE-N005 · P1 · Seed scripts refuse hosted or production databases and ship no default admin credential

*Surfaces:* api  ·  *Type:* security/permission

**Before:** A repo checkout of the release commit on an operator machine. A local MongoDB on 127.0.0.1. A throwaway hosted cluster URI (never production).

**Steps:**

1. From apps/api, run node scripts/seed-dev.mjs with MONGODB_URI set to the throwaway mongodb+srv:// URI and without SEED_ALLOW_REMOTE. It exits 1 before connecting with 'seed-dev: refusing to seed — MONGODB_URI uses mongodb+srv:// (a hosted cluster).' plus the local-only explanation. The URI is not echoed.
2. Run it with NODE_ENV=production and a local URI. It refuses with 'NODE_ENV is production'.
3. Run it with mongodb://10.0.0.5:27017/x. It refuses because the URI points at a non-local host. With SEED_ALLOW_REMOTE=I_UNDERSTAND_THIS_WIPES_DATA it is allowed (non-SRV, non-production only).
4. Repeat the refusals with scripts/seed-e2e.mjs.
5. Run seed-dev against 127.0.0.1 without SEED_ADMIN_PASSWORD. It completes, logs 'seed-dev: SEED_ADMIN_PASSWORD not set — skipping the admin account' and creates no admin@ujimora.com. With SEED_ADMIN_PASSWORD set, the admin uses that password.
6. Confirm seed-dev.mjs at the release commit no longer contains a literal admin password (git history still does; handle it under COMPLIANCE-69 and COMPLIANCE-85).

**Expect:** Seed scripts cannot wipe a hosted or production database by accident and no known default admin credential ships, which matters given the earlier data-loss incident.

**Needs:** Local MongoDB, throwaway hosted cluster

**Source:** `apps/api/scripts/seedGuard.mjs`, `apps/api/scripts/seed-dev.mjs`, `apps/api/scripts/seed-e2e.mjs`, `apps/api/__tests__/infrastructure/seedGuard.test.ts`

## COMPLIANCE-N006 · P1 · Consent history is append-only, survives account erasure and is backfilled in production

*Surfaces:* api  ·  *Type:* compliance

**Before:** Staging DB. An owner-approved window for a production write. umask 077 on the operator machine.

**Steps:**

1. On staging, register user A, then force a re-acceptance (COMPLIANCE-13). legal_acceptance_events has a 'register' and a 'reaccept' event for A.
2. Delete A's account and wait for the erasure sweep. A's profile data is erased but A's legal_acceptance_events documents (userId, version, flags, acceptedAt, source) remain.
3. Confirm no API route reads, edits or deletes these events.
4. From apps/api with MONGODB_URI pointing at a staging copy of production, run npx tsx scripts/backfill-legal-acceptance-events.ts. It prints {"mode":"dry-run","candidates":N,"inserted":0}, where N is the number of users with a stored legalAcceptance and no event (closed accounts included).
5. Run it with --apply. It prints {"mode":"apply","candidates":N,"inserted":N}. Run --apply again: candidates 0, inserted 0.
6. Run it with an unknown argument. It fails with 'Legal acceptance backfill failed: Set MONGODB_URI; arguments: [--apply].' and exit code 1.
7. In production, run the dry run, get owner approval, run --apply, and archive both outputs in restricted storage.

**Expect:** Every account with a stored acceptance has at least one consent event. History is never overwritten, the backfill is idempotent, and consent evidence survives erasure. Its retention is set in COMPLIANCE-31.

**Needs:** MongoDB Atlas write access (owner-approved)

**Source:** `apps/api/scripts/backfill-legal-acceptance-events.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoLegalAcceptanceLog.ts`, `apps/api/src/infrastructure/database/models/LegalAcceptanceEventModel.ts`, `apps/api/src/application/use-cases/RegisterUserUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`

## COMPLIANCE-N007 · P1 · Staff-assisted account closure from the admin console

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Staging. Admin A with USERS delete permission. Admin B. Member M with no balances. Member N with a wallet balance. A deletion request email from M's registered address.

**Steps:**

1. In admin, open M's member detail page. The 'Account closure' panel shows 'Close account'. It is disabled for staff without USERS delete permission and is not shown on administrator accounts.
2. Open it. The dialog 'Close this account' warns 'This signs the member out everywhere and starts erasure of their profile data. It cannot be undone from the console.' It asks 'How the request was verified (at least 20 characters)' and 'Type the account email to confirm'. The button stays disabled until both are valid.
3. Type a wrong email. Expect 400 'The confirmation email does not match this account.' Nothing changes and no audit row is written.
4. Enter a valid note and M's email (any letter case) and close. M's sessions end (next API call 401), an erasure request appears in /privacy-requests, and the audit log has 'account.staff_closure' with A as actor and the note as reason. A second attempt returns 404 'Account not found'.
5. Try to close N. Expect 409 starting 'Your account can’t be closed yet. First withdraw or resolve: …'.
6. API checks: as a member, POST /api/v1/admin/users/:id/close returns 403. Targeting admin B returns 409 'Administrator accounts cannot be closed from the console.' Targeting A's own id returns 409 'Close your own account from your profile, not the staff console.' With a stale or demoted admin token: 403 'Current administrator access is required.'

**Expect:** Staff close accounts only through the erasure path, with typed confirmation, a verification note and an audit record. Administrators and the caller's own account are excluded, and outstanding money blocks closure. Merge risk to check first: adminAccountClosureRoutes.ts calls deleteAccount.execute(id) with no credentials, but app.ts:1211 wires DeleteAccountUseCase with the MFA step-up that requires the account holder's password. If the console shows 'Enter your current password to delete your account…' (HTTP 400) and M stays open, log a P1 bug. In that case the account.staff_closure audit row has already been written, and admin-account-closure.integration.test.ts should fail on this branch. Known open issue I083: no staff-assisted email change and no written identity-verification runbook.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/adminAccountClosureRoutes.ts`, `apps/api/src/application/use-cases/DeleteAccountUseCase.ts`, `apps/api/src/app.ts (DeleteAccountUseCase wiring, /admin/users mount)`, `apps/admin/src/components/AccountClosureControl.tsx`, `apps/admin/src/pages/UserDetailPage.tsx`, `apps/api/__tests__/integration/admin-account-closure.integration.test.ts`

## COMPLIANCE-N009 · P1 · Sign-out revokes the session on the server for web, admin and native

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** A test account signed in on web and on a phone, and an admin account on the console. DevTools and a proxy to capture refresh tokens.

**Steps:**

1. On web, copy the refresh token from uf_tokens in localStorage, then sign out. The Network tab shows POST /api/v1/auth/logout {refreshToken} returning 200 'Signed out'.
2. POST /api/v1/auth/refresh with the copied token. Expect 401 'Invalid or expired refresh token'.
3. Confirm the phone's session still works (sign-out is per session). Refresh on the phone several times, sign out there, and confirm its last refresh token is rejected.
4. Repeat on the admin console.
5. Sign out while offline. Local sign-out still completes; record that the server session then stays valid until the refresh token expires (the revoke is best effort).
6. After sign-out, call an API with the copied access token. Record that it keeps working until it expires (up to 15 minutes).
7. Change the password on web. The initiating session stays signed in with the new tokens, while the phone's session ends.

**Expect:** Sign-out revokes that session's refresh token on the server (revoked_sessions, 8-day TTL) without affecting other sessions, and a password change keeps the current device signed in. Known open issue I031: there is no refresh-token rotation with reuse detection, access tokens stay valid for up to 15 minutes after sign-out, and tokens are still stored in localStorage.

**Needs:** Proxy tool

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/AuthController.ts (logout, refreshToken)`, `apps/api/src/application/services/AuthTokenService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoSessionRevocation.ts`, `apps/api/src/infrastructure/database/models/RevokedSessionModel.ts`, `packages/ui/src/browserSession.ts`, `apps/mobile/src/lib/session.ts`

## COMPLIANCE-N010 · P1 · User-supplied URLs are limited to safe schemes and platform-hosted media; uploads are type- and size-limited

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Staging with CLOUDINARY_CLOUD_NAME set. A signed-in member with a current agreement. Organization signup available. Read-only production DB.

**Steps:**

1. PUT /api/v1/profile with avatarUrl 'https://evil.example/pixel.png'. Expect 400 'Upload the image through Ujimora'. Repeat for the cover image, creator avatar and cover, campaign imageUrls and campaign-update mediaUrls.
2. Try 'javascript:alert(1)', 'data:image/png;base64,…', an http:// Cloudinary URL, 'https://user:pass@res.cloudinary.com/…', another cloud's res.cloudinary.com URL and a URL with a port. All are rejected.
3. Use a URL returned by POST /uploads/image (https://res.cloudinary.com/<cloud>/image/upload/…). It is accepted, and '' clears the image.
4. On organization signup, enter the website 'javascript:alert(1)' or 'ftp://x'. Expect 'Enter a full web address starting with https://'.
5. POST /uploads/image: a PDF to a non-kyc folder returns 415 'PDF files are only accepted for verification documents.'; an unknown folder returns 400 'Unknown upload folder.'; a 4.5 MB image returns 413 'File is too large (max 4MB).'
6. Send malformed JSON to any JSON route. Expect 400, not 500.
7. Check that web forms show the server's field error. Record native behavior.
8. In production, list profiles and campaigns whose stored image URLs are not on the production Cloudinary cloud and hand the list to the owner.

**Expect:** No third-party tracking pixels, script schemes or off-platform media can be stored going forward, uploads are constrained by type and size, and legacy values are reported for an owner decision. Known gap from I102: the mobile app does not yet display these field errors or pre-validate the website field.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/urlSchemas.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/errorHandler.ts`

## COMPLIANCE-N011 · P1 · Minimum supported app version gate as the native lever for legal-version bumps and rollback

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Staging API with editable MIN_APP_VERSION_IOS/ANDROID and APP_STORE_URL_IOS/ANDROID. Staging builds of known versions installed on iOS and Android.

**Steps:**

1. GET /api/v1/app/config with no auth. Expect 200 with data.minSupportedVersion {ios:null, android:null} and storeUrls.android 'https://play.google.com/store/apps/details?id=com.ujimora.app', plus Cache-Control: public, max-age=300.
2. Set MIN_APP_VERSION_ANDROID above the installed version and relaunch the Android app. A blocking 'Update required' screen reads 'This version of Ujimora (<v>) is no longer supported. Update to version <min> or later from Google Play to keep using your account, donations and campaigns.' 'Update Ujimora' opens the Play listing. The screen sits above the biometric lock.
3. Background the app for more than 5 minutes and resume. The check runs again on resume.
4. On iOS with APP_STORE_URL_IOS unset, raise MIN_APP_VERSION_IOS. 'Update Ujimora' opens only the App Store home (itms-apps://apps.apple.com/). Set APP_STORE_URL_IOS to the real listing before raising the minimum in production.
5. Set the minimum equal to or below the installed version. The app works normally.
6. Put the phone in airplane mode, stop the API, or return an unparseable version. The app opens (fails open).
7. Set an invalid MIN_APP_VERSION_IOS such as 1.x. The API refuses to boot.
8. Drill on staging: bump LEGAL_ACCEPTANCE_VERSION with a new build that ships the new text, and raise the minimum only after that build is live in both stores.

**Expect:** Operators can force upgrades per platform without blocking anyone by default. The screen is accurate, failures fail open, and the runbook ties minimum-version raises to store availability and legal-version bumps. Limits to record: builds released before this gate never call /app/config, and the API does not return 426 or a LEGAL_VERSION_OUTDATED 409 for old builds (not done in I094).

**Needs:** Staging API, installed staging builds

**Source:** `apps/api/src/infrastructure/config/mobileApp.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/appConfigRoutes.ts`, `apps/mobile/src/components/UpdateRequiredGate.tsx`, `apps/mobile/src/lib/appUpdate.ts`, `apps/mobile/app.json (updates.enabled)`, `apps/mobile/APP_REVIEW_NOTES.md`

## COMPLIANCE-N012 · P1 · Cookie Notice matches the browser storage actually used on web, admin and marketing

*Surfaces:* admin, marketing, web  ·  *Type:* compliance

**Before:** Production or staging web, admin and marketing in a clean browser profile with DevTools. A test account, a campaign, a creator with tips and a subscription plan. An affiliate ?ref= link.

**Steps:**

1. Open https://ujimora.com/cookies (and app /cookies) and note section 2: sign-in keys uf_tokens, uf_user, accessToken, uf_last_activity; display keys uf_color_mode, uf_skin; payment recovery uf_pending_donations, uf_pending_subscriptions, ujimora:tip-attempt:* and session-only top-up references; referral uf_ref. Privacy section 10 says no cookies, analytics or advertising technologies are used.
2. In the clean profile, browse marketing, sign up through a ?ref= link, sign in on the app, start a donation, a subscription checkout, a tip and a wallet top-up, and change theme and skin. After each step, list Application > Cookies and Local/Session Storage for each origin.
3. Cookies: confirm none are set by ujimora.com, app.ujimora.com or admin.ujimora.com. Record any third-party or Vercel cookie.
4. Compare storage keys with the notice. Flag keys not listed, for example uf_tokens:received (added by the clock-skew fix) and ujimora-topup-reference-<ref> in sessionStorage (covered only as 'session-only top-up references'). On admin expect uf_admin_tokens, uf_admin_user, uf_admin_token, uf_admin_last_activity, uf_admin_color_mode, uf_admin_skin and uf_admin_tokens:received.
5. Sign out. uf_tokens, uf_user, uf_last_activity, uf_tokens:received and the legacy accessToken/refreshToken are removed. Stay idle for more than an hour and confirm sign-in storage is cleared.
6. Resolve the tip and top-up. Their entries are removed. Create an account and confirm uf_ref is removed.
7. In the Network tab, confirm no requests go to analytics or advertising hosts on any page.

**Expect:** The notice accurately describes every storage item and its lifetime, and there are no cookies or trackers. Any key the notice does not list, such as uf_tokens:received, is added to the notice or justified in writing, and legal signs off.

**Needs:** Legal review

**Source:** `packages/types/src/legal.ts (cookies, privacy section 10)`, `packages/ui/src/browserSession.ts`, `apps/web/src/lib/session.ts`, `apps/admin/src/lib/session.ts`, `apps/marketing/src/pages/LegalPolicyPage.tsx`

## COMPLIANCE-N013 · P1 · KYC approvals without an expiry date count as expired; pre-launch production data check and renewal window

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Read-only production DB. Staging accounts: U1 with an approved identity KYC record whose expiryDate is removed; U2 with an approval expiring more than 30 days from now; U3 with an approval expiring within 30 days.

**Steps:**

1. In production (read-only), count approved records without an expiry: db.kycverifications.countDocuments({status:'approved', $or:[{expiryDate:{$exists:false}},{expiryDate:null}]}). List the affected users, campaign owners with balances first.
2. On staging as U1, the KYC status reports expired, the profile shows the current evidence-backed verification level (not the stored badge), and a payout request returns 409 'The account holder’s identity verification is missing, expired or under renewal…'.
3. U1 can resubmit identity KYC immediately.
4. U2 resubmits and gets 409 'Your identity verification is current. You can renew it from <YYYY-MM-DD>, 30 days before it expires.' The web KYC card does not invite an early update.
5. U3 resubmits and it is accepted. While the renewal is pending, payouts are refused because a newer pending record suspends the older approval. Note this for user communications.
6. Agree and send a message to affected production users before launch explaining that they must renew verification.

**Expect:** No user keeps payout or campaign privileges on an approval without an expiry date. The 30-day renewal window is enforced, and affected production users are identified and told before launch.

**Needs:** MongoDB Atlas read-only user

**Source:** `apps/api/src/domain/services/currentKycEvidence.ts`, `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/application/use-cases/SubmitKYCIdentityUseCase.ts`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutEligibility.ts`

## COMPLIANCE-N014 · P1 · Paystack chargeback and provider-refund events are recorded once and surfaced to staff

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Staging with the Paystack test secret to sign webhooks. A settled campaign donation, a settled creator tip and a settled web subscription. An admin and a member account.

**Steps:**

1. Send a signed charge.dispute.create for the donation reference. One Dispute appears in admin /disputes (COMPLIANCE-39) and one providerpaymentevents document (kind dispute) holds no donor email, name or card data. The log shows alert provider_dispute 'paystack reported a payment dispute — needs staff attention'.
2. Resend the identical event. No new event and no new case.
3. Send charge.dispute.create for the tip and the subscription references. Each is recorded in providerpaymentevents and no Dispute is created. They are listed at GET /api/v1/admin/payments/provider-events and can be marked reviewed with POST /api/v1/admin/payments/provider-events/:id/acknowledge. As a member, both return 403.
4. Send refund.processed for a donation that no Ujimora refund operation requested. A 'Refund issued outside Ujimora' case appears for staff.
5. Redeliver charge.success for a donation that is already refunded or disputed. It returns 200 (no retry loop) and credits nothing.
6. Check the admin console: non-campaign provider events have no UI page, and no ledger reversal happened automatically.

**Expect:** Every provider dispute and refund is recorded once with an alert. Campaign cases pause payouts, and non-campaign cases are visible to staff through the API. Known open issue I009: there are no automatic holds, clawbacks or ledger reversals, subscriptions are not ended on refund, and there is no admin page for non-campaign provider events.

**Needs:** Paystack test secret for signed webhooks

**Source:** `apps/api/src/application/use-cases/RecordProviderPaymentEventUseCase.ts`, `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/infrastructure/database/models/ProviderPaymentEventModel.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `apps/admin/src/pages/DisputesPage.tsx`

## COMPLIANCE-16 · P2 · Creator tip and crypto message acknowledgement (web only); native shows no tip form

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging. A creator with an active paid plan. Paystack test keys. For the crypto step only: staging with CRYPTO_PAYMENTS_ENABLED=true and the mock provider (NODE_ENV not production).

**Steps:**

1. On web /creators/<handle>, enter a message and confirm the acknowledgement is required.
2. POST /api/v1/creators/<handle>/tips with a message and no legalAcceptance.
3. POST /api/v1/campaigns/:id/donations/crypto with a message and no legalAcceptance.
4. Open creators/<handle> on iOS and on Android.

**Expect:** Both API calls return 428 before any checkout or deposit address is created. Web requires the checkbox. Native shows no payment form.

**Needs:** Paystack test keys, staging crypto mock

**Source:** `apps/api/src/application/use-cases/CreateTipIntentUseCase.ts`, `apps/api/src/application/use-cases/CreateCryptoDepositUseCase.ts`, `apps/web/src/pages/CreatorTipPage.tsx`, `apps/mobile/app/creators/[handle].tsx`

## COMPLIANCE-86 · P2 · Contact form data handling, staff alert and the complaint route

*Surfaces:* admin, api, email, marketing  ·  *Type:* compliance

**Before:** An admin account. Access to the staff alert mailbox (REVIEW_ALERT_EMAIL or the admin Settings override). Resend configured.

**Steps:**

1. Submit the ujimora.com/contact form with a name, email and message. The success text reads 'Thank you for reaching out. Our team will review your message and reply by email.' (no 24-hour promise).
2. The staff mailbox receives one email 'New contact message — <subject>' with reply-to set to the submitter and a link to https://admin.ujimora.com/contact-submissions. Replying reaches the submitter. No acknowledgement email goes to the submitter.
3. Confirm it appears in admin /contact-submissions and only admins can read it: as a member, GET /api/v1/contact returns 403. If loading fails, the admin page shows an error with Retry instead of an empty inbox.
4. Submit 11 times within 15 minutes. The 11th returns 429. The marketing site still calls the API through the Vercel rewrite, so check from a second network whether visitors share this 10-per-15-minute budget (COMPLIANCE-N004).
5. Confirm the Privacy notice covers contact data, including that it is copied to a staff mailbox through Resend, and its retention, and that complaints can be escalated to legal@ and the DPC.

**Expect:** Submissions are stored privately and readable only by admins, staff are alerted by email, spam is rate-limited, and the complaint path is documented. Any 429 seen by a first-time visitor because of the shared rewrite bucket is logged as a finding.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/ResendReviewAlerts.ts (contactReceived)`, `apps/marketing/src/pages/ContactPage.tsx`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`, `apps/marketing/.env.production`

## COMPLIANCE-87 · P2 · Consent, legal and payment flows are accessible

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** VoiceOver and TalkBack. A keyboard.

**Steps:**

1. With a screen reader, complete register (check the checkbox labels are read), the KYC notice and acknowledgement, donate, account deletion and the legal screens.
2. Repeat at 200% text size.
3. On web, complete register, donate and Settings deletion with the keyboard only.
4. Check colour contrast on the checkboxes and error text.

**Expect:** Every consent control can be perceived and operated. Consent is not valid if the user cannot perceive it.

**Needs:** Physical devices

**Source:** `apps/web/src/components/auth/RegisterForm.tsx`, `apps/mobile/app/(auth)/register.tsx`, `apps/mobile/STORE_SUBMISSION.md`
