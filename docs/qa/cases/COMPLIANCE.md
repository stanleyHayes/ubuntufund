# Ghana & store compliance, operations (88 cases)

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
4. Compare these with LEGAL_ENTITY and with the Privacy section 'Optional organization website requests', which names Neurodyne Corp Ltd as parent.
5. Compare with the operator paragraph in apps/mobile/APP_REVIEW_NOTES.md.

**Expect:** One consistent legal entity appears everywhere. If it changes, update packages/types/src/legal.ts and all store listings in one release. The Apple account is an Organization account, as required for financial apps (Guidelines 3.2.1(viii) and 5.1.1(ix)). The settlement account is in the operator's name. Any mismatch blocks submission.

**Needs:** App Store Connect, Play Console, Paystack dashboard

**Source:** `packages/types/src/legal.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md (C01, C19)`

## COMPLIANCE-07 · P0 · Marketing, SEO and store metadata make no unsupported regulatory claims (escrow, protection, licensing)

*Surfaces:* android, ios, marketing, web  ·  *Type:* compliance

**Before:** Store listing drafts and screenshots are available.

**Steps:**

1. Run curl -s https://ujimora.com | grep -i escrow and inspect meta description, og:description, twitter:description and the JSON-LD block.
2. Open https://ujimora.com/pricing and app /subscription and note the 'Escrow & milestones' plan feature.
3. Search store descriptions and screenshots for 'escrow', 'protected', 'licensed', 'regulated', 'guaranteed', 'verified campaigns' and 'trust scores'.
4. Ask legal whether Ujimora operates a regulated escrow arrangement under the BoG crowdfunding framework.
5. Confirm whether a 'community trust score' feature actually exists.

**Expect:** No escrow or protection claim unless legal confirms a regulated arrangement. The plan-feature label matches what escrowSupport actually gates (split proceeds and collaboration: CampaignSplitUseCase.ts:49, InviteCollaboratorUseCase.ts:56). Store metadata is accurate (Apple 2.3.1). apps/marketing/index.html currently says 'escrow protection' (lines 10, 11, 40, 54, 73). Fix it or obtain legal sign-off before launch.

**Needs:** Legal review

**Source:** `apps/marketing/index.html`, `apps/marketing/src/pages/PricingPage.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `apps/mobile/src/screens/SubscriptionScreen.tsx`, `apps/api/src/application/use-cases/CampaignSplitUseCase.ts`

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

1. Sign in on web and try each publish action: create a campaign at /campaigns/new, post a comment, post an update, make the profile public, upload a campaign image.
2. Confirm each returns 428 ('Accept the current account agreement before publishing.') and the UI routes to /account-agreement.
3. Check both boxes and click 'Save agreement'. Expect 'Your agreement has been saved.'
4. Retry the publish actions.
5. Repeat on the native account-agreement screen.
6. While not accepted, confirm Settings, data-rights requests, account deletion, the wallet view and payout requests are not blocked.

**Expect:** Publishing is blocked until acceptance, then succeeds. Non-publishing features are unaffected, as the contentAcceptance.ts policy requires. Acceptance is stored with a server timestamp.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/contentAcceptance.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/organizationTeamRoutes.ts`, `apps/web/src/components/auth/AccountAgreement.tsx`, `apps/mobile/app/account-agreement.tsx`

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

**Before:** Fresh installs of signed iOS and Android 13+ builds. The production AAB/APK file.

**Steps:**

1. Use the app through signup, donation (Android), settings and live viewing.
2. Confirm the OS notification permission prompt never appears.
3. On Android, check App info > Permissions: Notifications is not listed as requested.
4. Run aapt2 dump permissions (or bundletool dump manifest) on the release artifact. POST_NOTIFICATIONS must be absent.
5. Authenticated: POST /api/v1/notifications/push/register. Expect 503 and no token stored.
6. DELETE /api/v1/notifications/push/unregister twice. Both succeed.
7. Confirm Settings labels push and SMS as unavailable.
8. Capture network traffic and confirm no Expo push or Firebase registration endpoints are contacted.

**Expect:** No permission prompt, no notification permission and no push identifiers collected. Store privacy answers can truthfully say no push tokens are collected.

**Needs:** Physical devices, mitmproxy/Charles

**Source:** `apps/mobile/app.json (blockedPermissions)`, `apps/mobile/plugins/withDisabledPushAutoInit.js`, `apps/api/src/infrastructure/adapters/inbound/http/routes/notificationRoutes.ts`, `docs/compliance/PUSH_NOTIFICATIONS.md`

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

**Before:** A test account with donation history, a comment, a public profile and a creator page. Signed in on web and phone at the same time. An active store sandbox subscription on native. One variant with a pending payout.

**Steps:**

1. On native, open Settings > Delete Account and read the warning (records retained; store subscriptions must be cancelled in the store). Confirm.
2. Check the phone is signed out.
3. On web, the next API call returns 401 and the refresh token fails.
4. Try to sign in with the old credentials. It is rejected.
5. Check the public profile and creator page are hidden, comments are hidden and donations show as anonymous.
6. In admin /privacy-requests, confirm a deletion or residual-review entry exists.
7. Confirm donations, ledger and campaign totals are unchanged.
8. Confirm newsletter, activity alerts and push tokens were removed.
9. For the pending-payout variant, confirm the server's refusal reason is displayed.
10. Repeat through web Settings > Delete account.

**Expect:** The account closes immediately and sessions are revoked on all devices. The sweep completes personal-data cleanup while financial records stay intact. The store-cancellation warning is shown before confirmation.

**Needs:** App Store/Play sandbox for the subscription variant

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts (DELETE /)`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.ts`, `apps/mobile/app/settings.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `docs/compliance/DATA_RIGHTS.md`, `docs/compliance/READINESS.md (C07)`

## COMPLIANCE-29 · P0 · Private KYC documents: 60-second signed access, owner or admin only

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** User A with KYC uploads. User B. An admin. Cloudinary configured.

**Steps:**

1. As A, upload ID front, ID back and a selfie in /kyc. The client receives kyc://<id> references, not https URLs.
2. As A, GET /api/v1/uploads/kyc/:id/access. The response has a URL, expiresInSeconds 60 and Cache-Control no-store.
3. Open the URL. It works. Retry after 61 s. It is denied.
4. As B, request A's document ID. Expect 403 or 404.
5. Logged out, request it. Expect 401.
6. As admin, preview the document in /kyc-review. It works, and an access audit is logged without the URL.
7. Request an unauthenticated plain delivery URL for the asset's public_id. It is denied.
8. POST /api/v1/uploads/sign with folder kyc. Expect 400 'Use the private document upload flow for verification documents'.

**Expect:** KYC files are reachable only by the owner or a current admin, and each access link works for 60 seconds.

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/api/src/application/use-cases/SignCloudinaryUploadUseCase.ts`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`

## COMPLIANCE-30 · P0 · Cloudinary production isolation, no unsigned uploads, legacy public KYC assets migrated

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Cloudinary console access. A privacy lead is available.

**Steps:**

1. Confirm whether production still reuses the dev cloud dvoqbonr2 (render.yaml says 'Reusing the dev cloud for now'). If so, confirm which people and keys can reach the production KYC folder.
2. Under Upload presets, check preset 'ujimora' (from apps/web/.env.production VITE_CLOUDINARY_UPLOAD_PRESET).
3. Run curl -F upload_preset=ujimora -F file=@x.png https://api.cloudinary.com/v1_1/dvoqbonr2/image/upload.
4. Carry out PRIVATE_KYC_ROLLOUT steps 1-7: inventory legacy KYC assets, migrate them to authenticated delivery, invalidate the CDN, and verify unauthenticated denial of original and derived URLs.
5. The privacy lead records an incident assessment for any earlier public exposure.

**Expect:** The unsigned upload fails. Production media is isolated from dev keys and no KYC asset is publicly reachable. An incident assessment is on record.

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

## COMPLIANCE-35 · P0 · Current KYC gates campaign creation and automatic payouts

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Staging accounts: unverified member; member with approved identity; organization with business verification; member whose KYC expiryDate is in the past; a campaign with an open dispute. Paystack test transfers.

**Steps:**

1. As the unverified member, open /campaigns/new and GET /api/v1/campaigns/creation-options. Creation is blocked or limited.
2. As the verified member, create a campaign.
3. As the expired-KYC member, request an automatic GHS payout. It is rejected with a current-owner-verification error.
4. As an owner with an unverified email, request an automatic payout. It is rejected.
5. As an organization at a level below 3, request an automatic payout. It is rejected.
6. Request an automatic payout on the campaign with an open dispute. It is blocked.

**Expect:** Financial privileges require current verification and each refusal shows a clear error. No transfer is initiated.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/application/use-cases/CreateCampaignUseCase.ts`, `docs/payments/automatic-payouts.md`, `docs/compliance/KYC_REVIEW_INTEGRITY.md`

## COMPLIANCE-36 · P0 · Manual payout approval for an owner with expired or unverified KYC (AML control gap)

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Staging. A campaign owner whose KYC is expired or rejected, with an eligible balance. An admin.

**Steps:**

1. As the owner, request a standard (manual) payout.
2. In admin /payouts, open the request and check whether the owner's current KYC status and expiry are shown.
3. Approve it.

**Expect:** Policy: approval is blocked, or needs an explicit override with a recorded justification, and staff can see the KYC state. In source, only the automatic path (MongoAutomaticPayoutVerification) checks that KYC is current. The manual ApprovePayoutUseCase path relies on staff judgement (READINESS C13 lists 'manual' consumers as open). If approval succeeds silently, treat it as a launch blocker or adopt a written SOP.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `docs/compliance/READINESS.md (C13)`

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

## COMPLIANCE-38 · P0 · Payout maker-checker, single-transfer ceiling and early-withdrawal cap

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** Staging with PAYOUT_DUAL_APPROVAL_AMOUNT=1000 (or the admin Settings override). Two admins. Paystack test transfers.

**Steps:**

1. Record the production value: render.yaml sets PAYOUT_DUAL_APPROVAL_AMOUNT '0', which disables dual approval. Get a written owner decision.
2. On staging, request a GHS 1,500 payout. Admin 1 approves; it stays pending second approval.
3. Admin 1 approves again. It is rejected.
4. Admin 2 approves. The transfer is initiated exactly once.
5. Request a MoMo payout above 50,000 (PAYOUT_MAX_TRANSFER_AMOUNT). It is rejected ('exceeds the single-transfer ceiling').
6. Request an early payout for more than 80% of the eligible balance. It is rejected.
7. Double-click Approve. Only one transfer results.

**Expect:** All payout controls are enforced, and the production threshold is a documented decision.

**Needs:** Paystack test transfers

**Source:** `apps/api/src/infrastructure/config/index.ts (payouts)`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `render.yaml`

## COMPLIANCE-39 · P0 · Fraud and safety reports reach staff; disputes and pauses hold funds without losing them

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** A signed-in reporter. A live campaign with a balance. An admin.

**Steps:**

1. Report the campaign as 'fraudulent' via POST /api/v1/campaigns/:id/report from the Report UI.
2. File a safety report with reason 'fraud' and another with 'child_safety'.
3. In admin /reports and /safety-reports, confirm the child_safety report is listed first.
4. Open a dispute in admin /disputes. Automatic payout is blocked.
5. Pause or block the campaign. New donations are rejected and the balance is unchanged.
6. Logged out, try to report. Expect 401.
7. Submit a duplicate report. It is idempotent.
8. Submit 21 safety reports in 15 minutes. The last returns 429.

**Expect:** Reports reach the staff queues. Disputes and pauses hold funds without changing balances.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`, `apps/admin/src/pages/DisputesPage.tsx`, `docs/compliance/MODERATION_OPERATIONS.md`

## COMPLIANCE-40 · P0 · AML/CFT programme, sanctions/PEP screening and FIC reporting SOP (tabletop)

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Owner, legal counsel and the compliance officer available.

**Steps:**

1. Confirm Ujimora's status under Act 1044 (accountable institution, or reliance on Paystack) and name the compliance officer.
2. Document sanctions/PEP screening for organizers and beneficiaries. It is manual, because the source has no screening provider.
3. Document the suspicious-transaction escalation route to the FIC and the record-retention period.
4. Tabletop: a campaign receives 30 donations of GHS 9,999 from the same card within one hour. Who notices (the code has no automated transaction monitoring), what is frozen (dispute/pause) and what is reported?

**Expect:** A written SOP exists with named owners. The tabletop produces concrete actions, and the lack of automated monitoring is documented.

**Needs:** Legal, FIC guidance

**Source:** `docs/compliance/READINESS.md (GH-AML, C13)`, `docs/compliance/RFI_KYC_APPLICABILITY.md`, `packages/types/src/legal.ts (REGULATORY_BASIS)`

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

## COMPLIANCE-45 · P0 · Subscription price and auto-renew disclosure before purchase (web Paystack; native IAP per Apple 3.1.2)

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** App Store sandbox tester and Play license tester. Store products configured.

**Steps:**

1. On web /subscription, before paying, confirm the price, billing interval, renewal terms, any taxes/fees and a link to /billing-terms are visible.
2. On iOS, open the Subscription tab. Confirm the store-localized price and period, auto-renewal wording, links to Subscription terms, Terms of Use (EULA) and Privacy, 'Restore purchases', and a manage link that opens App Store subscriptions.
3. On Android, confirm the same with Play wording and a manage link.
4. Confirm no Paystack/web price or checkout link appears anywhere in the native apps.

**Expect:** All required disclosures are present on every surface, and native apps contain no external purchase path.

**Needs:** App Store sandbox, Play license testing

**Source:** `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `apps/web/src/pages/SubscriptionPage.tsx`, `packages/types/src/legal.ts (billing-terms)`, `docs/compliance/STORE_BILLING.md`

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

**Before:** A TestFlight or production-signed iOS build with EXPO_PUBLIC_WEB_URL=https://app.ujimora.com. An active campaign with a slug.

**Steps:**

1. Open a campaign and tap Donate. ExternalFundraisingScreen appears with no donor fields.
2. Tap the continue-in-browser button. Safari (not an in-app sheet) opens https://app.ujimora.com/c/<slug>/donate.
3. Check the URL contains only the slug, an optional amount and liveSessionId: no token, email or name.
4. In Safari, tap other app.ujimora.com links. You stay in Safari; nothing bounces back to the app (no associated domains).
5. Return to the app. It does not claim the payment succeeded.
6. On a live session, tap 'Support this campaign'. The same external flow runs.
7. Tap Wallet > Fund wallet. Safari opens /wallet.
8. Browse all screens for any in-app checkout, including pending-payment 'Open secure checkout' (PaymentStatus).
9. Confirm the DB shows no donation intents created from the iOS app during the test.

**Expect:** The iOS app collects no payments in-app (Guidelines 3.1.1 and 3.2.2(iv)).

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

**Before:** Production has STORE_BILLING_ENABLED=true, STORE_BILLING_PRODUCTS, STORE_RECEIPT_ENCRYPTION_KEY_BASE64, APPLE_IAP_* and GOOGLE_PLAY_*. None of these are in render.yaml. Sandbox and license testers ready.

**Steps:**

1. Authenticated: GET /api/v1/store-billing/catalog/apple and /google. Expect available:true, with product IDs matching App Store Connect and Play.
2. On iOS, buy the monthly plan in sandbox. The plan activates after server verification.
3. Delete and reinstall, then tap Restore purchases. The plan is restored.
4. Sign in with a different account on the same device. The purchase does not transfer.
5. On Play, buy and confirm the order is acknowledged within 3 days in Play Console.
6. Cancel, let expire and refund in sandbox. The entitlement is removed after the store notification.
7. On web /subscription with the store-billed account, only 'manage in App Store/Google Play' is shown, with no web checkout.
8. Check admin /store-billing: the review queue is empty or handled.

**Expect:** IAP works end to end on production configuration, with no Paystack fallback in native apps.

**Needs:** App Store sandbox, Google Play license testing, Google Pub/Sub

**Source:** `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/storeBillingRoutes.ts`, `apps/mobile/src/lib/storeBilling.ts`, `apps/mobile/src/screens/SubscriptionScreen.native.tsx`, `docs/compliance/STORE_BILLING.md`

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

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Console access. A reviewer demo account created in production.

**Steps:**

1. App Store Connect: 18+ rating questionnaire (UGC, unrestricted web access), App Privacy, Privacy URL https://ujimora.com/privacy, Support URL https://ujimora.com/contact, EULA link, subscription group and products, export compliance.
2. Play Console: target audience 18+, content rating, Data safety, account deletion URL, financial features (crowdfunding via Paystack; no loans, investments or crypto), foreground-service declaration, Ads: No, App access with the demo credentials.
3. Replace every <...> placeholder in apps/mobile/APP_REVIEW_NOTES.md.
4. On a clean device, sign in as the reviewer. Confirm role user (not admin), KYC approved, MFA and biometric off. Confirm browsing, a campaign draft and Report/Block are all reachable.
5. Confirm the screenshots match the current UI and show no in-app payment on iOS.

**Expect:** No placeholders remain anywhere, and the reviewer account works end to end.

**Needs:** App Store Connect, Play Console

**Source:** `apps/mobile/APP_REVIEW_NOTES.md`, `apps/mobile/STORE_SUBMISSION.md`, `docs/compliance/READINESS.md (C19)`

## COMPLIANCE-60 · P0 · UGC safeguards meet Apple 1.2 and Play UGC on native and web

*Surfaces:* admin, android, ios, web  ·  *Type:* compliance

**Before:** Two signed-in users. An admin. Content exists on each surface.

**Steps:**

1. Confirm Report is present on comments, campaign updates, donor messages, member and organization profiles, creator pages and live sessions.
2. Confirm Block user is present on profiles, creators and live sessions, and Settings lists blocked users with Unblock.
3. Confirm posting requires the current agreement (see COMPLIANCE-12).
4. Submit a report. It appears in admin /safety-reports.
5. The admin hides the content. It disappears for all viewers.
6. The admin restricts publishing for the author. The author's next post is refused with the appeal contact shown.
7. Confirm blocked users' content is hidden in both directions.

**Expect:** Report and Block controls are present on every native and web surface, and the moderation queue works end to end.

**Needs:** None

**Source:** `docs/compliance/MODERATION_OPERATIONS.md`, `docs/compliance/CONTENT_MESSAGES.md`, `apps/api/src/infrastructure/adapters/inbound/http/routes/userSafetyRoutes.ts`, `apps/admin/src/pages/SafetyReportsPage.tsx`

## COMPLIANCE-62 · P0 · Mobile production build points at the HTTPS production API and web origins

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** EAS project access.

**Steps:**

1. In EAS environment variables/secrets for the production profile, confirm EXPO_PUBLIC_API_URL=https://api.ujimora.com (or .../api/v1) and EXPO_PUBLIC_WEB_URL=https://app.ujimora.com. eas.json production sets only UJIMORA_RELEASE=1.
2. Install the production build and confirm it launches and loads campaigns. Without EXPO_PUBLIC_API_URL, api.ts throws 'EXPO_PUBLIC_API_URL is required for production builds'.
3. Build a test variant with an http:// API URL. It must fail at startup.
4. Share a campaign. The link uses https://app.ujimora.com/c/<slug>.
5. Confirm expo-updates has no update URL (no OTA) and record that in the rollback plan.

**Expect:** The build targets HTTPS production and contains no development hosts.

**Needs:** EAS

**Source:** `apps/mobile/src/lib/api.ts`, `apps/mobile/src/lib/fundraising.ts`, `apps/mobile/eas.json`, `apps/mobile/app.json`

## COMPLIANCE-63 · P0 · Production environment variable audit on Render (presence and validity, values never copied)

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Render dashboard access to ujimora-api > Environment.

**Steps:**

1. Check NODE_ENV=production and MONGODB_URI (Atlas SRV, TLS, replica set, production database name).
2. Check JWT_SECRET and JWT_REFRESH_SECRET are at least 32 characters and different.
3. Check CORS_ORIGINS lists exactly the four https origins, PUBLIC_WEB_URL=https://app.ujimora.com and PUBLIC_API_URL=https://api.ujimora.com.
4. Check PAYSTACK_SECRET_KEY starts with sk_live_, the public key with pk_live_, and PAYSTACK_APPROVAL_REQUIRE_SIGNATURE=true.
5. Check RESEND_API_KEY, FROM_EMAIL on a verified domain, REPLY_TO_EMAIL, REVIEW_ALERT_EMAIL and ADMIN_WEB_URL.
6. Check AUTH_EMAIL_ENCRYPTION_KEY_BASE64 decodes to 32 bytes. It is NOT in render.yaml.
7. Check MFA_ENCRYPTION_KEY is 44-character base64 of 32 bytes. It is NOT in render.yaml.
8. Check STORE_BILLING_*, APPLE_IAP_* and GOOGLE_PLAY_*. None are in render.yaml.
9. Check LIVEKIT_*, CLOUDINARY_* and OPENAI_API_KEY.
10. Check no numeric fee variable is blank, CRYPTO_MOCK_WEBHOOK_SECRET is absent and LOG_LEVEL=info.
11. Record present or absent for each variable, with an owner.

**Expect:** Every required variable is present and valid. Keys are unique per purpose and stored only in Render secrets. Missing variables are added before launch.

**Needs:** Render dashboard

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/infrastructure/config/storeBilling.ts`, `apps/api/src/app.ts`, `docs/compliance/ACCOUNT_EMAILS.md`

## COMPLIANCE-64 · P0 · Password recovery and email verification work in production

*Surfaces:* android, api, email, ios, web  ·  *Type:* functional

**Before:** A real production test account and inbox.

**Steps:**

1. On web /forgot-password, request a reset. The response is the generic success, not 503 'Password recovery is temporarily unavailable'.
2. The email arrives from FROM_EMAIL, and the link opens https://app.ujimora.com/reset-password with the token in the URL fragment.
3. Reset the password. Other sessions are revoked and a 'password changed' notice email arrives.
4. Reuse the link. It is rejected.
5. Request another link and wait more than 30 minutes. It has expired.
6. Request a reset for an unknown email. Response and timing look the same.
7. From Settings, send an email verification. The confirm page needs a button click.
8. Repeat the reset from native forgot-password.

**Expect:** Password reset and email verification both work in production. They depend on AUTH_EMAIL_ENCRYPTION_KEY_BASE64, Resend and an HTTPS PUBLIC_WEB_URL (AccountEmails.configured).

**Needs:** Resend

**Source:** `apps/api/src/application/use-cases/ForgotPasswordUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/AccountEmails.ts`, `apps/web/src/pages/ResetPasswordPage.tsx`, `apps/web/src/pages/VerifyEmailPage.tsx`, `apps/mobile/app/forgot-password.tsx`

## COMPLIANCE-66 · P0 · Launch feature flags and commercial-config overrides match signed decisions

*Surfaces:* admin, api  ·  *Type:* compliance

**Before:** Render env access. Admin Settings access. Owner and legal available.

**Steps:**

1. Record the production value of each flag and attach a decision: SPLIT_PROCEEDS_ENABLED (render.yaml 'true' with comment '§6 cleared', but config/index.ts says it needs Ghana legal §6 sign-off; attach that sign-off), CRYPTO_PAYMENTS_ENABLED=false, PAYMENTS_MULTI_CURRENCY_ENABLED=false, PAYMENTS_INTERNATIONAL_CARDS_ENABLED=false, PAYMENTS_FLUTTERWAVE_ENABLED=false, AI_WRITING_ENABLED=true (OpenAI terms), PAYMENTS_RECONCILIATION_ENABLED=true, PAYOUT_DUAL_APPROVAL_AMOUNT=0, CAMPAIGN_AUTO_APPROVE_MAX_TIER=3, and AFFILIATE_*.
2. Open admin Settings and record overrides that take precedence over env: tiers, review alert email, referral discount, payout fees.
3. Call GET /api/v1/campaigns/creation-options and check splitEnabled matches the decision.

**Expect:** Every flag and override has a documented owner decision.

**Needs:** Render dashboard

**Source:** `render.yaml`, `apps/api/src/infrastructure/config/index.ts`, `apps/api/src/application/services/CommercialConfigService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/CampaignController.ts`

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

## COMPLIANCE-68 · P0 · CORS allows only the configured origins

*Surfaces:* api  ·  *Type:* security/permission

**Before:** curl.

**Steps:**

1. Run curl -sI -H 'Origin: https://evil.example' https://api.ujimora.com/api/v1/campaigns. No Access-Control-Allow-Origin header.
2. Repeat with Origin https://app.ujimora.com. That origin is echoed with Access-Control-Allow-Credentials: true.
3. Send an OPTIONS preflight for POST /api/v1/auth/login from the evil origin. Nothing is allowed.
4. Confirm CORS_ORIGINS is set in Render. If it is empty outside development, app.ts falls back to origin:true, which reflects any origin.

**Expect:** Only the four approved origins are allowed.

**Needs:** None

**Source:** `apps/api/src/app.ts (cors)`, `apps/api/src/infrastructure/config/index.ts (corsOrigins)`, `render.yaml`

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

1. Confirm the plan of ujimora-api. render.yaml says plan: free, which sleeps after inactivity with a 30-60 s cold start (DEPLOYMENT.md).
2. On a free-plan staging instance, idle 20 minutes, then send a Paystack test webhook. Measure response time against Paystack's timeout and retry behavior.
3. Confirm that setInterval jobs (reconciliation, erasure, store billing, alerts) do not run while the instance sleeps.
4. In Atlas, confirm the cluster tier supports backups and transactions (M0 has no backups).
5. Confirm Network Access is not 0.0.0.0/0 (DEPLOYMENT.md suggests it) and the DB user has least privilege.

**Expect:** The API runs on an always-on paid instance with a backed-up cluster. Atlas network access is restricted or formally risk-accepted.

**Needs:** Render, MongoDB Atlas, Paystack

**Source:** `render.yaml`, `DEPLOYMENT.md`, `apps/api/src/app.ts (scheduled jobs)`

## COMPLIANCE-71 · P0 · Rate limiter keys on the real client IP behind the Vercel rewrite and Render proxy

*Surfaces:* api, web  ·  *Type:* security/permission

**Before:** Two devices on different networks (for example home broadband and a mobile hotspot). A test account.

**Steps:**

1. From network A, send 31 POST requests to https://app.ujimora.com/api/v1/auth/login with a wrong password. The 31st returns 429.
2. Immediately, from network B, log in with correct credentials. It must succeed.
3. Check X-RateLimit-Remaining on network B's first requests. It should be near the full budget (29 of 30, or 299 of 300), not shared with network A.
4. Look at the ip field of a new audit-log entry. It should be the client's IP, not a proxy address.
5. Repeat directly against https://api.ujimora.com.

**Expect:** Limits should apply per client. app.ts has no app.set('trust proxy'), so req.ip is probably the proxy's address. If network B is throttled, one abusive client can lock out every user with 300 requests per 15 minutes: that is a launch blocker.

**Needs:** Two networks

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/auditMutation.ts`, `vercel.json`

## COMPLIANCE-74 · P0 · Admin console and admin APIs enforce the admin role on the server

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** A member account and an admin account.

**Steps:**

1. Sign in to https://admin.ujimora.com as a member. The access-denied page shows.
2. As the member, call admin APIs: GET /api/v1/users (admin list), /api/v1/admin/wallets, /api/v1/admin/donations, /api/v1/kyc/pending, /api/v1/audit, /api/v1/analytics, /api/v1/admin/commercial-config, and a payout approve endpoint under /api/v1/payouts. Each returns 403.
3. Call the same APIs logged out. Each returns 401.
4. Demote the admin in the DB. The next request with the old token returns 403.
5. Confirm admin/index.html contains robots noindex.
6. Confirm admin mutations appear in the audit log with the actor.
7. Start an export, then demote the admin mid-export. The export aborts.

**Expect:** The server enforces the admin role on every admin endpoint; the UI guard is not the only check.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`, `apps/api/src/app.ts (route mounts)`, `apps/admin/src/router.tsx`, `docs/compliance/ADMIN_EXPORTS.md`, `docs/compliance/STAFF_ACCESS.md`

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

**Before:** Render and Vercel access. Staging.

**Steps:**

1. Render: deploy a harmless change, then use Rollback. The service is healthy again in under 5 minutes.
2. Vercel: use Instant Rollback on web, admin and marketing.
3. autoDeploy:true means every push to main goes straight to production. Agree branch protection or a staging gate before launch.
4. Confirm DB migrations such as migrate-refund-index.ts work with the previous release.
5. Kill switches: PAYMENTS_PAYSTACK_ENABLED=false (donate is disabled gracefully), AI_WRITING_ENABLED=false, STORE_BILLING_ENABLED=false (existing entitlements kept), crypto stays off, and admin can pause a campaign.
6. Mobile has no OTA channel. Document the hotfix path (expedited review) and which server flags can disable a broken native feature.

**Expect:** Rollback steps are timed and documented, and every kill switch is verified.

**Needs:** Render, Vercel

**Source:** `render.yaml`, `vercel.json`, `apps/api/scripts/migrate-refund-index.ts`, `apps/api/src/infrastructure/config/index.ts`, `apps/mobile/app.json`

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

## COMPLIANCE-85 · P0 · No test data, test keys or placeholder content in production

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* compliance

**Before:** Read-only production DB. Admin access.

**Steps:**

1. Search production campaigns and users for 'test', 'demo', 'e2e' and the seeded names from scripts/seed-e2e.mjs and seed-dev.mjs.
2. Review blog and site-content seeds (seedBlogIfEmpty, seedSiteContentIfEmpty) and the CMS About, FAQ and Contact pages.
3. Confirm the Paystack keys in use are live and the admin Payment providers page shows live mode.
4. Search the site and apps for 'Lorem', 'TODO', '<...>' and example.com.
5. Confirm no placeholders remain in the store notes.

**Expect:** Production contains only real, reviewed content and live configuration.

**Needs:** None

**Source:** `apps/api/scripts/seed-e2e.mjs`, `apps/api/scripts/seed-dev.mjs`, `apps/api/src/main.ts`, `apps/admin/src/pages/PaymentProvidersPage.tsx`, `apps/mobile/APP_REVIEW_NOTES.md`

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

**Before:** An external mailbox to send test messages from.

**Steps:**

1. Send a test message to info@, support@, legal@, trust@ and sales@ujimora.com.
2. Reply to a transactional email (REPLY_TO_EMAIL is info@ujimora.com) and confirm the reply lands in a read mailbox.
3. On /delete-account (web) and the native Delete-your-account screen, tap 'Request account and data deletion by email'.
4. Confirm the mail client opens addressed to legal@ujimora.com with subject 'Ujimora account and personal-data deletion request' and the body template.
5. Record time to first human acknowledgement for each mailbox.

**Expect:** No bounces. Each mailbox has a named owner and an agreed response time. The mailto is prefilled correctly on web, iOS and Android. If no mail client is available, native shows 'Unable to open link' with the legal@ address.

**Needs:** Mail hosting for ujimora.com, Resend

**Source:** `packages/types/src/legal.ts (LEGAL_ENTITY.emails, delete-account actions)`, `apps/mobile/src/components/LegalScreen.tsx`, `render.yaml (REPLY_TO_EMAIL)`

## COMPLIANCE-06 · P1 · Promises in legal copy are backed by real artifacts, or the copy is amended

*Surfaces:* api, marketing, web  ·  *Type:* compliance

**Before:** Staging DB access. A legal reviewer is available.

**Steps:**

1. Terms section 15 promises 'Historical versions remain available': find the archive URL.
2. Privacy section 7 promises 'a separate retention schedule by data category': obtain the approved schedule (DATA_RIGHTS.md says none is approved yet).
3. Terms section 14 promises 'a documented complaint and escalation process': obtain the SOP.
4. Cookie Notice sections 3-5 promise a preferences UI and a 'production cookie table': look for a consent UI and a table.
5. Organizer Agreement section 10 promises acceptance 'with ... the relevant campaign ID': create a campaign on staging and inspect its Mongo document and user record for a campaign-bound acceptance.
6. Privacy section 5 promises 'contractually governs processors': obtain the list of DPAs.

**Expect:** Each promise has evidence, or the copy is corrected before launch. Source shows no archive route and no cookie-preference UI. Campaign creation only checks account-level acceptance (MongoCampaignCreation.ts:14) and stores no per-campaign acceptance with a campaign ID. The retention schedule is unapproved. Expect these to be findings unless they are resolved.

**Needs:** Legal review

**Source:** `packages/types/src/legal.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.ts`, `docs/compliance/DATA_RIGHTS.md`

## COMPLIANCE-13 · P1 · Consent record integrity and a version-bump drill

*Surfaces:* android, api, ios, web  ·  *Type:* compliance

**Before:** A staging environment you can redeploy with a changed constant.

**Steps:**

1. POST /api/v1/profile/legal-acceptance twice for a current user. Confirm acceptedAt does not change on the second call.
2. POST a body that includes an acceptedAt field. It must be ignored or rejected.
3. Staging only: bump LEGAL_ACCEPTANCE_VERSION, redeploy API, web and native, and confirm every existing user is prompted before publishing.
4. Confirm an old client that still sends the old version gets 400.
5. After re-acceptance, check whether the previous version and timestamp are retained anywhere.

**Expect:** The record is server-stamped and clients cannot set timestamps. After a version bump, every user is prompted again. Evidence of prior acceptance should be retained, but profileRoutes.ts:74 currently $set-overwrites legalAcceptance, so it is lost. Record this as a finding for legal.

**Needs:** Staging redeploy

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts`, `packages/types/src/legal-acceptance.ts`

## COMPLIANCE-15 · P1 · Anonymous guest donation with no message: confirm the 18+ policy decision

*Surfaces:* android, api, web  ·  *Type:* compliance

**Before:** Staging with Paystack test keys. Tester signed out.

**Steps:**

1. On web, donate with 'anonymous' checked and no message. Confirm no age/terms checkbox is shown and checkout proceeds.
2. POST /api/v1/donation-intents with no legalAcceptance, no message and isAnonymous true. Confirm it is accepted.
3. Ask legal whether Contributor Terms (minimum age 18) must be acknowledged for every contribution, and whether the APP_REVIEW_NOTES wording is accurate.

**Expect:** Behavior matches a written legal decision. Source currently lets anonymous no-message guests donate with no 18+ confirmation (donationContentAgreement returns undefined). If legal requires acknowledgement for every contribution, this is a launch blocker.

**Needs:** Paystack test keys, legal decision

**Source:** `apps/api/src/application/services/messageAgreement.ts`, `apps/web/src/pages/DonatePage.tsx`, `packages/types/src/legal.ts (contributor-terms)`

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
2. Verify the email and enable only 'donation confirmations' by email.
3. Make a test donation. Only that alert is delivered.
4. Turn the alert off with a message queued. The queued message is suppressed.
5. On organization signup, confirm the website request is unchecked by default and the privacy notice names Neurodyne Corp Ltd as recipient.
6. Check the website request, then use 'Withdraw website request'. The withdrawal persists after reload and a later profile save does not restore it.
7. Confirm no marketing email follows signup or donation.

**Expect:** Each channel is a separate opt-in with a server timestamp. Withdrawals take effect. Signup and donation imply no marketing consent.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/profileRoutes.ts (website-request)`, `docs/compliance/ACTIVITY_ALERTS.md`, `packages/types/src/legal.ts (privacy: website requests)`

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

*Surfaces:* admin, android, ios, web  ·  *Type:* functional

**Before:** User A (member) and an admin account.

**Steps:**

1. As A on web Settings, submit an access request (details of at least 10 characters).
2. Submit a second access request. It is rejected because one unresolved request per kind is allowed.
3. Submit a correction and a complaint. Both are accepted.
4. Open native Settings and confirm the same three requests appear.
5. In admin /privacy-requests, confirm the queue is sorted by target date (submission + 30 days). Record internal evidence and publish a response.
6. As A, read the response in Settings. Download the JSON on web; use the share sheet on native.
7. Confirm no automatic email is sent and the UI tells the user to check Settings.
8. Send 21 requests within 15 minutes. The last returns 429.

**Expect:** The flow works end to end with a fixed target date. Internal evidence is never shown to the requester. Audit events are recorded.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/dataRightsRoutes.ts`, `apps/admin/src/pages/PrivacyRequestsPage.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/mobile/app/settings.tsx`, `docs/compliance/DATA_RIGHTS.md`

## COMPLIANCE-28 · P1 · Deletion retries, historical closure audit and the email-only deletion path

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Staging. Read-only production MongoDB credentials. umask 077 on the operator machine.

**Steps:**

1. On staging, make the erasure step fail (for example with a temporarily invalid provider credential). Request deletion. The request stays pending and admin sees retry state.
2. Restore the credential. The next sweep (every 60 s in production, also at boot) completes it.
3. From apps/api, run npx tsx scripts/audit-account-closure.ts <cutoff at least 30 min old> against production, paging with nextCursor until it is null.
4. Triage any exit-2 findings. Keep the reports out of Git.
5. Drill: send a deletion request email to legal@ from a registered address. Staff verify ownership, process the deletion in admin, and reply within the agreed time.

**Expect:** Retries are idempotent. The audit ends with exit 0 or documented triage. The email path has an owner and a time target.

**Needs:** MongoDB Atlas read-only user

**Source:** `apps/api/scripts/audit-account-closure.ts`, `docs/compliance/ACCOUNT_CLOSURE_AUDIT.md`, `apps/api/src/app.ts (erasureTimer)`, `apps/api/src/main.ts`

## COMPLIANCE-31 · P1 · Retention schedule approved per category and TTL indexes present in production

*Surfaces:* api  ·  *Type:* compliance

**Before:** Legal and accountant input. Read-only production DB.

**Steps:**

1. Review the DATA_RIGHTS.md retention table with counsel: tokens, newsletter, profile, financial/KYC/AML (Act 1044 record-keeping), privacy/safety/audit logs, provider receipts, live/media, and Render/Vercel logs.
2. In production, run getIndexes() on the password-reset and email-verification token collections and confirm TTL indexes exist.
3. Compare the approved schedule with Privacy section 7.
4. Confirm a legal-hold procedure exists.

**Expect:** A signed retention schedule exists and TTL indexes are present. No category is retained indefinitely without justification.

**Needs:** Legal, MongoDB Atlas

**Source:** `docs/compliance/DATA_RIGHTS.md`, `packages/types/src/legal.ts (privacy section 7)`

## COMPLIANCE-32 · P1 · On-device data protection: logout cleanup, backup exclusion, app-switcher privacy

*Surfaces:* android, ios  ·  *Type:* compliance

**Before:** Signed release builds on physical devices. A second Android device for the transfer test.

**Steps:**

1. Sign in, start an Android donation to leave a pending-payment record, then log out.
2. Relaunch. The app is signed out and shows no prior name or pending checkout from the old account.
3. On Android, trigger a Google backup and a device-to-device transfer to the second phone. The app has no data and no session there (allowBackup=false plus the extraction rules).
4. On iOS, enable biometric lock and background the app. The app switcher shows the privacy cover.
5. Reinstall on iOS and check that no session is silently restored from Keychain, or that the behavior is documented.

**Expect:** No credentials or personal data remain on the device after logout. Backups and device transfers exclude app data.

**Needs:** Physical devices

**Source:** `apps/mobile/app.json (allowBackup)`, `apps/mobile/plugins/withPrivateBackupRules.js`, `apps/mobile/src/lib/session.ts`, `docs/compliance/NATIVE_PERMISSIONS.md`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## COMPLIANCE-41 · P1 · KYC review integrity: self-review, concurrent decisions, duplicate submissions, Request More

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Staging. Two admins. One admin with their own pending KYC.

**Steps:**

1. The admin tries to approve their own KYC. It is denied.
2. Two admins approve and reject the same record at the same moment. One succeeds, one returns 409, and there is one audit entry.
3. One user submits identity KYC twice concurrently. One returns 201 and one 409.
4. Click 'Request More' in admin. It reports unavailable and the status does not change.
5. Submit KYC referencing another user's document ID. It is rejected.

**Expect:** Every race resolves to a single committed decision, and no false status is shown.

**Needs:** None

**Source:** `docs/compliance/KYC_REVIEW_INTEGRITY.md`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`, `apps/admin/src/pages/KYCReviewPage.tsx`

## COMPLIANCE-43 · P1 · Donation confirmation and receipt promises match what is actually emailed

*Surfaces:* email, web  ·  *Type:* compliance

**Before:** Paystack test keys. A guest email inbox.

**Steps:**

1. Donate as a guest (no account) and list every email received (Paystack, Ujimora).
2. Open https://app.ujimora.com/donate/callback with no reference and read the message.
3. As a signed-in donor with activity email off, donate and list the emails received.

**Expect:** UI copy must match what is actually sent. DonateCallbackPage.tsx:214 says 'your receipt is emailed once payment is confirmed', but Ujimora only emails opted-in account holders. If guests get no Ujimora receipt, change the copy.

**Needs:** Paystack test keys, Resend

**Source:** `apps/web/src/pages/DonateCallbackPage.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

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

## COMPLIANCE-65 · P1 · MFA is available and every admin account is known and MFA-protected

*Surfaces:* admin, android, api, ios, web  ·  *Type:* security/permission

**Before:** Read-only production DB. Access to the admin accounts.

**Steps:**

1. Authenticated: GET /api/v1/auth/mfa. Expect available:true, which means MFA_ENCRYPTION_KEY is valid.
2. Enable an authenticator on each admin. Sign-in then requires a code. A recovery code works exactly once.
3. Query production for users with role 'admin'. Confirm each is an intended staff member with MFA on. Remove test or demo admins. (Admins are created by a direct DB update per DEPLOYMENT.md.)
4. Confirm the App Review demo account has role user.

**Expect:** MFA is available. Only intended staff hold admin, and every admin uses MFA.

**Needs:** Authenticator app

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/mfaRoutes.ts`, `apps/api/src/application/services/Totp.ts`, `docs/compliance/STAFF_ACCESS.md`, `DEPLOYMENT.md`

## COMPLIANCE-72 · P1 · Per-endpoint rate limits return 429 correctly; webhooks are exempt

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Staging. A load tool.

**Steps:**

1. Exceed each limit and confirm a 429 JSON response with a Retry-After header: general 300 per 15 min; auth (register, login, forgot, reset, MFA, email verification) 30; donation intents, payout requests and tip verify 60; newsletter 20; contact 10; safety reports 20; data rights 20; store billing 40.
2. Send 400 signed test events to /api/v1/webhooks/paystack. None are throttled by the API limiter.
3. Note that /api/v1/auth/refresh sits only under the general limit.
4. Check the web and native UIs show a friendly 'Too many requests' message.

**Expect:** Each limit behaves as coded. Also record a known limitation: the in-memory limiter resets on every deploy and is not shared across instances.

**Needs:** Paystack test signature

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/authRoutes.ts`, `apps/api/src/app.ts`

## COMPLIANCE-73 · P1 · Security headers on the API and frontends; admin cannot be framed; UGC is XSS-safe

*Surfaces:* admin, api, marketing, web  ·  *Type:* security/permission

**Before:** curl. A test HTML page for the iframe test. A signed-in test account.

**Steps:**

1. Run curl -sI https://api.ujimora.com/health. Expect HSTS, X-Content-Type-Options: nosniff, frame protection, Referrer-Policy, no X-Powered-By, and X-Robots-Tag noindex.
2. Run curl -sI on https://app.ujimora.com, https://admin.ujimora.com and https://ujimora.com. Record CSP, X-Frame-Options/frame-ancestors, Referrer-Policy and Permissions-Policy. The vercel.json files define none.
3. Embed https://admin.ujimora.com in an iframe on a test page. It should be blocked.
4. Scan all three sites with Mozilla Observatory or securityheaders.com.
5. Enter <img src=x onerror=alert(1)> in a campaign title, comment, donor message and creator bio. Each must render as inert text. This matters because web and admin keep tokens in localStorage.

**Expect:** The admin console cannot be framed. A CSP is in place, or its absence is formally risk-accepted. No injected script executes.

**Needs:** None

**Source:** `apps/api/src/app.ts`, `vercel.json`, `apps/admin/vercel.json`, `apps/marketing/vercel.json`, `apps/web/src/context/AuthContext.tsx`, `apps/admin/src/context/AuthContext.tsx`

## COMPLIANCE-76 · P1 · Dependency and supply-chain audit on the release commit

*Surfaces:* admin, android, api, ios, marketing, web  ·  *Type:* security/permission

**Before:** A clean checkout of the release commit. npm 12.0.2.

**Steps:**

1. Run npm ci, then npm run test:dependency-security. It passes.
2. Run npm audit --omit=dev --json and compare with the baseline in DEPENDENCY_SECURITY.md: 9 entries (5 moderate, 4 high, 0 critical), all in the two patched chains. Any new high or critical blocks release.
3. Read the Vercel build logs for web, admin and marketing. Confirm the npm version and that the postinstall apply-security-patches step ran. The vercel.json installCommand is 'npm install', not 'npm ci', with no pinned npm.
4. Run Expo Doctor. Expect 20/20.
5. Confirm GitHub CI is green on the release commit.

**Expect:** No unreviewed high or critical findings remain. Builds are reproducible and include the security patches.

**Needs:** npm registry, Vercel, GitHub Actions

**Source:** `package.json`, `scripts/dependency-security.test.cjs`, `scripts/apply-security-patches.cjs`, `docs/compliance/DEPENDENCY_SECURITY.md`, `vercel.json`, `.github/workflows/ci.yml`

## COMPLIANCE-78 · P1 · Monitoring, alerting and scheduled-job health

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** An uptime/log monitoring tool. A staging instance where DB access can be cut.

**Steps:**

1. Set an uptime monitor on https://api.ujimora.com/health. That endpoint returns ok without checking MongoDB, so also add a synthetic check such as GET /api/v1/campaigns?limit=1.
2. On staging, block DB access. /health still returns 200 while the synthetic check fails and alerts.
3. Create alert rules for these log messages: 'scheduled reconciliation failed', 'Account erasure sweep failed', 'Store billing sweep failed', 'Live safety reconciliation failed', 'notification outbox retry failed'.
4. Define a daily check of admin action-center counts: pending reports, privacy requests, store billing review, live cleanup, crypto issues, refund recovery.
5. After a deploy, confirm the boot sweep log lines appear.
6. Record Render's log retention period and check it matches the retention schedule.

**Expect:** A named owner is alerted within minutes of an API or database outage or a failed job.

**Needs:** Monitoring provider

**Source:** `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/admin/src/pages/DashboardPage.tsx`

## COMPLIANCE-80 · P1 · Incident response tabletop covering breach, key leak, bad deploy, fraud and admin takeover

*Surfaces:* admin, api, email  ·  *Type:* recovery/idempotency

**Before:** Owner, engineer and privacy lead available.

**Steps:**

1. Paystack secret leaked: rotate it in Paystack and Render, redeploy, and confirm webhooks still verify.
2. KYC document exposure: contain it (Cloudinary invalidation), assess it, notify the DPC and users as required, and handle it through legal@.
3. The API will not start after a deploy (see RENDER_STARTUP_INCIDENT.md): roll back and fix forward.
4. A fraudulent campaign is collecting money: open a dispute to freeze payouts and decide on refunds.
5. An admin account is taken over: revoke it, rotate JWT secrets and review the audit log.
6. Confirm there is a contact tree, on-call rota, message templates and a vulnerability-disclosure contact. No security.txt exists under apps/*/public.

**Expect:** A written runbook exists with an owner and a time target for each scenario.

**Needs:** None

**Source:** `docs/compliance/RENDER_STARTUP_INCIDENT.md`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`, `docs/compliance/LOGGING_PRIVACY.md`, `apps/admin/src/pages/DisputesPage.tsx`

## COMPLIANCE-81 · P1 · Load and performance smoke test on staging with a money-integrity check afterwards

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Staging on the same plan as production. k6 or artillery. Paystack test keys. The rate-limiter caveat from COMPLIANCE-71 accounted for.

**Steps:**

1. Ramp to 100 virtual users over 5 minutes on campaign list, campaign detail, slug preview and leaderboard.
2. Create 50 concurrent donation intents with distinct idempotency keys, plus a burst of 200 signed test webhooks that includes duplicates.
3. Hold a live session with 200 SSE viewers for 10 minutes.
4. Monitor p95 latency (target under 1 s for reads, under 2 s for writes), error rate (under 1%), instance memory and Mongo connections.
5. Afterwards, run audit-donation-settlement on staging.
6. Run Lighthouse (mobile profile) on / and /c/<slug>.

**Expect:** Latency and error targets are met. There are no duplicate credits and the ledger balances. No request hits the 30 s server.requestTimeout.

**Needs:** Paystack test keys, load tool

**Source:** `apps/api/src/main.ts`, `apps/api/scripts/audit-donation-settlement.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`

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

## COMPLIANCE-86 · P2 · Contact form data handling and the complaint route

*Surfaces:* admin, api, marketing  ·  *Type:* compliance

**Before:** An admin account.

**Steps:**

1. Submit the ujimora.com/contact form with a name, email and message.
2. Confirm it appears in admin /contact-submissions and only admins can read it: as a member, call GET /api/v1/contact and expect 403.
3. Submit 11 times within 15 minutes. The 11th returns 429.
4. Confirm the Privacy notice covers contact data and its retention, and that complaints can be escalated to legal@ and the DPC.

**Expect:** Submissions are stored privately and readable only by admins. Spam is rate-limited, and the complaint path is documented.

**Needs:** None

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/contactRoutes.ts`, `apps/marketing/src/pages/ContactPage.tsx`, `apps/admin/src/pages/ContactSubmissionsPage.tsx`

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
