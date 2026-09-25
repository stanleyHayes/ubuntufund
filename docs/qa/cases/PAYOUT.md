# KYC, KYB & payouts (72 cases)

Identity and organization verification, staff review, payout accounts, cashouts, OTP, automatic payouts, dual approval, withdrawal limits.

[Back to the QA plan](../README.md)

## PAYOUT-01 · P0 · Individual identity KYC happy path on web (ID card + GhanaPost GPS + selfie)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** New-U: an individual with a verified email and no KYC records. Staging API with Cloudinary configured (authenticated delivery). Test images: ID front and back (JPG under 4MB), a selfie JPG, and one PDF ID scan.

**Steps:**

1. Sign in to app.ujimora.com as New-U and open /profile. In the KYC Status card, click 'Start Verification'. You land on /kyc.
2. Step 1 'Personal Info': enter the full name, pick an adult date of birth, choose Nationality 'Ghana' from the search list and enter an ID number. Click Next.
3. Step 2 'ID Document': keep 'ID card'. Upload the front (JPG) and back (PDF) and wait for both to finish (Next stays disabled while uploads run). Click Next.
4. Step 3 'Address Proof': Country Ghana, Region Greater Accra, City Accra. Keep the 'GhanaPost GPS' toggle and enter 'ga-183-8164' (lowercase). Click Next.
5. Step 4 'Selfie Verification': upload the selfie. Read the collection notice, tick the acknowledgement and click 'Submit Verification'.
6. Call GET /api/v1/kyc/status with New-U's token.
7. In Cloudinary, find the stored asset and try to open its plain /upload/ delivery URL without a signature.

**Expect:** The GPS field uppercases to GA-183-8164. The page shows 'Verification Submitted!' with 'Back to profile' and 'Go to Dashboard' buttons. /kyc/status returns kycStatus 'pending' and one identity verification with status 'pending'. The stored documents are kyc://<24-hex> references typed id_card, id_card and selfie, with no utility_bill. The response header is Cache-Control: private, no-store. The Cloudinary asset uses authenticated delivery, so the unsigned URL is denied. The Profile KYC Status card shows Pending.

**Needs:** Cloudinary

**Source:** `apps/web/src/pages/KYCPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/KYCController.ts`, `apps/api/src/application/use-cases/SubmitKYCIdentityUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`

## PAYOUT-04 · P0 · Server-side KYC validation cannot be bypassed via direct API calls

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Tokens for New-U and Other-U. Other-U has one uploaded kyc:// document id. A tool such as curl or Postman.

**Steps:**

1. POST /api/v1/kyc/identity as New-U with documents [{type:'id_card', url:'https://res.cloudinary.com/x/image/upload/a.jpg'}].
2. Repeat with url 'kyc://<Other-U document id>'.
3. Repeat with a valid own document and personalInfo.dateOfBirth set 17 years ago (ISO datetime).
4. Repeat with address {proofMethod:'ghana_post_gps', country:'Nigeria', city:'Lagos', gpsAddress:'GA-183-8164'}.
5. Repeat with address {proofMethod:'document', country:'Ghana', city:'Accra', street:'1 Test St'} and no utility_bill or bank_statement document.
6. Call GET /kyc/status afterwards.

**Expect:** Steps 1 and 2 return 400 'Upload each verification document using your private document uploader'. Step 3 returns 422 with the adult-age error. Steps 4 and 5 return 400 validation errors ('A Ghana address and GhanaPost GPS code are required.' and 'Street address and an address proof document are required.'). No new verification record appears in /kyc/status.

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/application/use-cases/SubmitKYCIdentityUseCase.ts`

## PAYOUT-05 · P0 · Private KYC document upload limits and access control

*Surfaces:* admin, api, web  ·  *Type:* security/permission

**Before:** New-U has uploaded a KYC document (kyc://ID). Other-U and Admin A are available. Test files: a 5MB image and a .docx.

**Steps:**

1. On /kyc, upload a file larger than 4MB, then a .docx file.
2. In the web uploader, click 'Preview private document' and note the link.
3. Call GET /api/v1/uploads/kyc/ID/access as New-U, as Other-U, logged out, and as Admin A.
4. Wait more than 60 seconds and reopen the URL returned in step 3.
5. In admin, open Audit Log and filter for action 'kyc.document.access'.
6. Temporarily unset the Cloudinary env vars on staging and try an upload.

**Expect:** Uploads above 4MB are rejected ('File is too large (max 4MB).', or HTTP 413 above 5MB on the server). The .docx is rejected with 415 'Only image or PDF files are allowed.' Access returns 200 {url, mimeType, expiresInSeconds:60} with Cache-Control no-store to the owner and admin, 404 'Document not found' to Other-U, and 401 when logged out. The link stops working after about 60 seconds. The audit entries have action kyc.document.access with resource kyc-document:<id> and no URL in the details. Without Cloudinary, the upload returns 503 'Image uploads are not configured on the server.'

**Needs:** Cloudinary

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/uploadRoutes.ts`, `apps/web/src/components/auth/PrivateDocumentUpload.tsx`, `apps/admin/src/components/kyc/KYCDocumentPreview.tsx`

## PAYOUT-07 · P0 · KYC collection notice and acknowledgement shown before submission (privacy compliance)

*Surfaces:* android, ios, web  ·  *Type:* compliance

**Before:** A user with no KYC. The text of KYC_COLLECTION_NOTICE and KYC_COLLECTION_ACKNOWLEDGEMENT from packages/types/src/legal-acceptance.ts.

**Steps:**

1. Web /kyc Step 4: compare the notice text with the source string and click the 'Privacy Notice' link.
2. iOS and Android: open Verification, start KYC and read Step 1 (the notice with the 'Privacy Policy' link), then Step 4 (the acknowledgement checkbox).
3. On mobile Step 3, read the 'Use my location' explanation text.

**Expect:** The notice text matches the source exactly on all platforms. The web link opens /privacy in a new tab. Mobile opens the in-app /privacy route. Submission is impossible until the acknowledgement is checked. The location text says coordinates are not saved and GPS does not generate a GhanaPost address.

**Source:** `packages/types/src/legal-acceptance.ts`, `apps/web/src/pages/KYCPage.tsx`, `apps/mobile/app/kyc.tsx`

## PAYOUT-08 · P0 · Native identity KYC with camera, library, document picker and location permissions

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Physical iPhone and Android devices on the release candidate build. A user with no KYC. A PDF in device Files and a file over 4MB.

**Steps:**

1. Profile tab → Verification → start verification.
2. Step 2: tap 'Camera' for the ID front and handle the camera permission prompt. Use 'Choose file' with the document picker for a PDF back. Try the file over 4MB.
3. Step 3: tap 'Use my location'. First deny the permission, then allow it in Settings and tap again.
4. Step 4: take a selfie with the camera, tick the acknowledgement and tap 'Submit verification'.
5. Tap 'View verification status'.
6. Background the app during an upload and return.

**Expect:** The system permission prompts show the configured purpose strings. The file over 4MB shows 'Choose a file smaller than 4 MB.' Denying location shows 'Location permission was declined. You can choose your address manually.' and manual entry still works. Allowing it fills country, region and city but no GPS code. Submission leads to 'Verification submitted' and the Verification screen shows a Pending card. No crash when resuming mid-upload, and busy states re-enable.

**Needs:** Cloudinary, physical devices

**Source:** `apps/mobile/app/kyc.tsx`, `apps/mobile/src/components/MediaUploadField.tsx`, `apps/mobile/app/verification.tsx`

## PAYOUT-09 · P0 · Organization KYB submission on web

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Owner-O: an organization account with a verified email and no business KYC. PDFs for the registration certificate, authorization letter, representative Ghana Card and ownership register.

**Steps:**

1. Sign in as Owner-O and open /kyc. Confirm the 'Organization verification' form loads, not the identity wizard.
2. Fill in the legal name, registration number, legal type, optional Tax ID, registered street, city and country.
3. Fill in the representative's name, an adult date of birth, nationality, ID number and 'Role and authority to act'.
4. For Person 1 choose Director with 60%. Click 'Add controlling person' and make Person 2 a Beneficial owner with 40%.
5. Enter an ownership explanation of at least 20 characters. Upload all four documents.
6. Confirm 'Submit organization verification' is disabled until both declaration checkboxes are ticked. Tick both and submit.
7. In admin, check the Audit Log for 'kyc.business_submitted'.

**Expect:** A success alert says 'Organization verification submitted for review...' and the form clears its sensitive fields. The 'Verification requests' panel shows Organization verification as 'awaiting staff review'. POST /kyc/business returns 201 {status:'pending', verificationType:'business'}. The audit entry exists and contains no document contents.

**Needs:** Cloudinary

**Source:** `apps/web/src/components/OrganizationKYCForm.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycBusinessRoutes.ts`

## PAYOUT-12 · P0 · Staff approves identity KYC with evidence attestation; level and expiry set

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** New-U has a pending identity application from PAYOUT-01. Admin A (role admin, MFA on).

**Steps:**

1. Admin A opens admin.ujimora.com/kyc-review and opens New-U's application.
2. Open each document preview and click 'Refresh expiring link' once.
3. Confirm Approve is disabled. Type findings under 20 characters and confirm it is still disabled. Tick 'I reviewed the application...', enter findings of at least 20 characters and click Approve.
4. As New-U, reload /kyc and /profile on web and the Verification screen on iOS.
5. Call GET /kyc/status as New-U and GET /api/v1/users/<New-U id> (public).
6. In admin, check the Audit Log for 'kyc.approved'.

**Expect:** The record becomes approved. expiresAt is approval date + 365 days, and the web shows 'Valid until <date>'. kycStatus is verified. The public profile verificationLevel is 2 and the TrustBadge shows 'Verified'. The applicant's /kyc/status does not contain reviewNotes or reviewedBy. The audit entry mentions the reviewed version and the staff attestation. Campaign creation now allows the NATIONAL_ID allowance.

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/admin/src/components/kyc/KYCDetailDialog.tsx`, `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/api/src/domain/services/currentVerificationLevel.ts`

## PAYOUT-13 · P0 · KYC approval evidence gates and version fencing (API)

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Pending identity records: (a) documents contain only a selfie, (b) blank fullName, (c) complete. Admin A token. The reviewVersion values from GET /kyc/pending.

**Steps:**

1. PUT /kyc/<a>/approve with a valid version, evidenceReviewed true and 25-char notes.
2. PUT /kyc/<b>/approve with the same settings.
3. PUT /kyc/<c>/approve with evidenceReviewed false, then with 10-char notes, then without reviewVersion, then with a made-up 64-hex version.
4. Approve <c> correctly, then approve it again.
5. Delete or close record c's applicant account in staging on another record, then approve.

**Expect:** (a) 422 'Identity approval requires an identity document...'. (b) 422 about the full name. False attestation or short notes give 422 'Confirm the evidence review...'. A missing version gives 428 'Refresh the verification queue before saving a review.' A wrong version gives 409 'This application has changed...'. A repeat approval gives 409 'This verification already has a decision.' A closed applicant gives 409 'Applicant account is unavailable.' No verification level changes on any failure.

**Source:** `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/api/src/application/services/kycReviewVersion.ts`

## PAYOUT-14 · P0 · KYC staff endpoints: role checks and self-review prevention

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A has submitted their own identity KYC. Owner-U (non-admin). Logged-out client.

**Steps:**

1. As Admin A, fetch /kyc/pending and PUT /kyc/<Admin A's own record>/approve with a valid version and attestation.
2. As Owner-U, call GET /kyc/pending, GET /kyc/stats, PUT /kyc/<id>/approve, PUT /kyc/<id>/reject and PUT /kyc/<id>/request-info.
3. Repeat step 2 without a token.
4. Revoke Admin B's admin role in the DB while their console stays open, then click Approve in their console.

**Expect:** Self-approval gives 403 'Another administrator must review your verification.' Owner-U gets 403 'Insufficient permissions' on every staff endpoint. Logged out gets 401. The revoked admin gets 401 'Your administrator session has ended.' No state changes occur.

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/api/src/infrastructure/adapters/inbound/middleware/requireRole.ts`

## PAYOUT-15 · P0 · Reject KYC with applicant-facing reason; applicant corrects and resubmits

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** A pending identity application from Other-U.

**Steps:**

1. Admin A → KYC Review → Reject. In 'Explain the verification decision', try to save a 10-character reason, then save a 40-character reason.
2. As Other-U, open web /kyc and the mobile Verification screen.
3. On web, submit a corrected application. On mobile, check that 'Submit corrected application' is hidden once a new application is pending.

**Expect:** Save stays disabled until the reason has 20 or more characters. The applicant sees 'Verification rejected · identity' with the exact reason on web and native, but not the internal notes. The web guidance says 'Correct your details and submit a new application...'. The new submission gets 201 pending. The history keeps the rejected record, and retryCount goes up by 1.

**Source:** `apps/admin/src/components/kyc/KYCRejectDialog.tsx`, `apps/api/src/application/use-cases/RejectKYCUseCase.ts`, `apps/web/src/components/KYCInformationRequests.tsx`, `apps/mobile/app/verification.tsx`

## PAYOUT-16 · P0 · Request-more-information round trip (staff ↔ applicant, web and mobile)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** Pending identity application from New-U. An extra bank statement PDF.

**Steps:**

1. Admin A → KYC Review → Request. Try a 10-character prompt, then save a 40-character prompt.
2. Confirm the application shows in_review and that Approve is disabled while the request is unanswered. Save a second request.
3. As New-U on web /kyc, find the prompt under 'Verification requests'. Click 'Attach a private document', choose type Bank statement, upload it, enter a response and click 'Submit response'.
4. Admin clicks 'Refresh queue', opens the application and approves it.
5. Repeat the flow with the response sent from the mobile Verification screen.

**Expect:** The prompt saves only with 20-2000 characters. The second request gets 409 'An information request is already awaiting a response.' The applicant sees 'Your response was submitted for review.' and the status returns to pending. The admin sees the response text and the new document in the history, and Approve is re-enabled and succeeds. The same works on mobile. No email is claimed: the request is available in-app only.

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`, `apps/web/src/components/KYCInformationRequests.tsx`, `apps/mobile/src/components/KYCInformationHistory.tsx`, `apps/admin/src/pages/KYCReviewPage.tsx`

## PAYOUT-19 · P0 · Staff approves organization KYB; institutional level and verified badge

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** Owner-O's pending business application from PAYOUT-09.

**Steps:**

1. Admin A opens the application and checks that the registered address, representative capacity, control persons with roles and %, the ownership explanation and the timestamped declarations are shown. Preview the four documents.
2. Attest and approve.
3. Open the public organizations list (web /organizations) and the org profile on web and mobile.
4. Negative: for a second org application, change the applicant's role to 'user' in the DB and then approve.

**Expect:** Approval succeeds. Owner-O's verificationLevel is 3 (INSTITUTIONAL) and the expiry is +365 days. The org card shows 'Verified organization'. For the changed role, approval returns 422 'Organization approval requires an active organization account.' and the status stays pending.

**Source:** `apps/api/src/application/use-cases/ApproveKYCUseCase.ts`, `apps/api/src/application/use-cases/GetOrganizationUseCase.ts`, `apps/admin/src/components/kyc/KYCDetailDialog.tsx`, `apps/web/src/pages/OrganizationsPage.tsx`

## PAYOUT-21 · P0 · KYC expiry downgrades current privileges and badges across surfaces

*Surfaces:* admin, android, api, ios, web  ·  *Type:* compliance

**Before:** Owner-U has an approved identity record and a funded campaign. Owner-O has approved KYB. Staging DB write access. Automatic payouts are enabled per PAYOUT-55.

**Steps:**

1. In Mongo, set the expiryDate of Owner-U's approved identity record and Owner-O's business record to yesterday.
2. As Owner-U, open web /kyc, /profile (KYC Status card), the public profile of Owner-U and a campaign page organizer badge.
3. Open the mobile Verification screen and Profile tab badge.
4. As Owner-U, try to create a new campaign.
5. Submit an automatic-eligible cashout (per PAYOUT-55).
6. Open the organizations list for Owner-O.

**Expect:** /kyc/status shows the record as 'expired' and kycStatus 'expired'. The web shows 'Submit a new application to renew verification.' Mobile shows an Expired badge and a 'Renew verification' button. The public TrustBadge falls to Basic or Unverified. The campaign allowance drops. The automatic payout stays PENDING with the reason 'Current owner identity or organization verification requires manual review.' Owner-O loses 'Verified organization'. Risk to check: GET /profile (own profile, mobile Profile tab badge) returns the stored historical verificationLevel and may still show 'Verified'. Log this if it differs from the public badge.

**Needs:** Staging DB access

**Source:** `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/domain/services/currentCampaignAllowance.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/application/use-cases/GetProfileUseCase.ts`, `apps/mobile/app/verification.tsx`

## PAYOUT-24 · P0 · Add saved MoMo payout account with name resolution and normalization

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Owner-U on a Free plan (limit 1) with no saved accounts. Paystack test keys with GH MoMo telco codes available via GET /banks?currency=GHS&type=mobile_money.

**Steps:**

1. Open /payout-accounts. In 'Add payout account', choose type Mobile money and network MTN, enter the account name and number '+233 24 123 4567', and submit.
2. Inspect the POST /payout-accounts response.
3. Add the same number again formatted as '024-123-4567'.

**Expect:** 201 with the account list. The number is stored normalized to '0241234567' and only the last 4 digits are shown. The card shows 'Registered name matched' if the Paystack-resolved name equals the entered name after normalization, otherwise 'Ownership review at cashout'. A resolution error never shows as matched. A Paystack recipient code is created. The duplicate returns the existing account without using a new slot, and the counter still says 1 of 1.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/account/SavedPayoutAccounts.tsx`, `apps/web/src/components/account/PayoutAccountCard.tsx`, `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.ts`

## PAYOUT-27 · P0 · Set campaign payout destination from the campaign cashout panel

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Owner-U has a funded campaign C1 with settled test donations and a saved account.

**Steps:**

1. Open C1's page as the owner and expand 'Cashout & payout history'.
2. Under 'Use a saved payout account', pick the saved account and click 'Verify & save payout account'.
3. Choose 'Add a new account' and save a different MoMo account.
4. Request a payout (see PAYOUT-31), then switch the destination back to the first account.

**Expect:** The first save shows the notice 'Payout account saved. No cashout has been requested yet...'. The panel shows 'Payout account: <name> · ending ####' plus a name-match alert. The new account becomes the campaign destination (the latest recipient). The already-requested payout keeps its original recipient: admin 'Review payout destination' shows the original account.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`, `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`

## PAYOUT-28 · P0 · Non-owners cannot view or act on campaign payouts

*Surfaces:* android, api, ios, web  ·  *Type:* security/permission

**Before:** Campaign C1 owned by Owner-U. Other-U. A collaborator on C1. An organization team member. A logged-out client.

**Steps:**

1. As each non-owner, open C1's page on web and check whether the 'Cashout & payout history' accordion is rendered.
2. On mobile, open campaign/manage?id=C1 as a non-owner.
3. As each non-owner, call GET /campaigns/C1/payout-options, GET /campaigns/C1/payouts, POST /campaigns/C1/payout-recipient, POST /campaigns/C1/payouts {amount:10} and POST /campaigns/C1/payouts/<id>/refresh.
4. Repeat the API calls logged out.

**Expect:** No cashout panel for non-owners on web. Mobile shows 'Only the campaign owner can manage these settings.' The API returns 403 with owner-only messages (for example 'Only the campaign owner can view payout details' and 'Only the campaign owner can request a payout'), and 401 when logged out. No payout or recipient is created.

**Source:** `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ListCampaignPayoutsUseCase.ts`, `apps/web/src/pages/CampaignDetailPage.tsx`, `apps/mobile/app/campaign/manage.tsx`

## PAYOUT-29 · P0 · Standard cashout request on funded campaign; eligible balance and breakdown

*Surfaces:* api, web  ·  *Type:* functional

**Before:** C1 is funded (goal reached) with an eligible balance of GHS 1,234.56 from settled Paystack test donations, and a recipient is set.

**Steps:**

1. Expand the cashout panel and note the eligible balance and each row of 'How your balance is calculated'.
2. Choose Standard, enter 1000 and check the quote: 'Additional cashout service fee' and 'You receive'.
3. Click 'Request cashout'.
4. Check the history card and call GET /campaigns/C1/payouts.

**Expect:** The quote shows fee GHS 0.00 and 'You receive GHS 1,000.00'. The notice reads 'Request <id>: awaiting admin review. Fee: GHS 0.00. You receive: GHS 1,000.00.' The history card is 'Awaiting review' with 'No transfer has been sent yet.' The payout has status PENDING, type standard, fee 0, net 1000, a requestKey, and provider 'paystack'. The eligible balance is still 1,234.56 (no reservation until approval). pending moves to available only by the shortfall.

**Needs:** Paystack test keys

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## PAYOUT-30 · P0 · Payout service fee accuracy across all services and boundaries

*Surfaces:* admin, api, ios, web  ·  *Type:* functional

**Before:** C1 is funded with eligible ≥ GHS 6,000. Default fee config (priority 0.5%/min 10, early 1%/min 20, urgent 1.5%/min 30, assisted 1.5% + 50).

**Steps:**

1. For each pair, enter the amount and service and record the web quote: priority 100 and 5000; early 1000 and 3000; urgent 1000 and 4000; assisted 1000 and 333.33.
2. Submit each (new key each time) and compare the stored payout fee and netAmount, and the admin card Fee and Net.
3. Enter priority 10 and assisted 50 (fee ≥ amount).
4. Repeat three of the cases on the iOS cashout panel.

**Expect:** Priority 100: fee 10.00, net 90.00. Priority 5000: fee 25.00, net 4,975.00. Early 1000: fee 20.00. Early 3000: fee 30.00. Urgent 1000: fee 30.00. Urgent 4000: fee 60.00. Assisted 1000: fee 65.00, net 935.00. Assisted 333.33: fee 55.00, net 278.33. The web quote, mobile quote, API and admin card all agree to the pesewa. Priority 10 and assisted 50 disable 'Request cashout', and the API returns 422 'The payout fee equals or exceeds the requested amount'.

**Source:** `apps/api/src/application/services/payoutFee.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`, `apps/admin/src/pages/PayoutsPage.tsx`

## PAYOUT-31 · P0 · Early-cashout rule for active campaigns below goal (80% reserve)

*Surfaces:* admin, android, api, ios, web  ·  *Type:* functional

**Before:** C2 is active, before its end date and below goal, with an eligible balance of GHS 1,000.00 and a recipient set.

**Steps:**

1. Open the cashout panel and inspect the 'Cashout service' options and the default.
2. Click Max and read the 'Maximum for this service' text.
3. Via the API, POST /campaigns/C2/payouts {amount:500, type:'standard'}, then {amount:810, type:'early'}.
4. Request early 800, then have an admin approve it.
5. Let C2 reach its goal (test donation) and reload.

**Expect:** Only Early and Urgent are offered, with Early as the default. Max gives 800.00 and the text says 'Keeps 20% of the current eligible balance in reserve.' The standard request gets 422 'This campaign is still active and below its goal. Select early or urgent cashout...'. The 810 request gets 422 'Early payouts are capped at 80% of the eligible balance (max GHS 800).' Early 800 succeeds with fee 20 and net 780. After the goal is reached, all 5 services appear.

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/services/payoutFee.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`

## PAYOUT-33 · P0 · Cashout amount validation (zero, negative, over balance, decimals, no recipient)

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** C1 is funded with eligible 1,234.56. C4 is a new funded campaign with no recipient.

**Steps:**

1. Enter 0, -5, 'abc' and 1234.57 and check whether 'Request cashout' is enabled.
2. Via the API, POST amount 1234.57, then amount 10.005 with type standard.
3. On C4, open the cashout panel and try to request, then POST /campaigns/C4/payouts {amount:10}.
4. On an Android device with a comma decimal locale, type '100,50'.

**Expect:** The button is disabled for invalid values. The API rejects 1234.57 with 422 'Cannot request a payout of GHS 1,234.57; only GHS 1,234.56 is available for payout.' 10.005 is rounded to 2 decimals and fee and net stay consistent. C4 has the button disabled and the API returns 400 'Add a payout recipient before requesting a payout'. The comma input must be handled or clearly blocked with no NaN request sent. Risk: mobile uses Number().

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## PAYOUT-34 · P0 · Cashout request idempotency: double tap, network drop, key reuse

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** C1 is funded with eligible 1,000 and a recipient set. DevTools network control.

**Steps:**

1. Enter 300 Standard and double-click 'Request cashout' quickly.
2. Enter 200. In DevTools, block the response (or go offline immediately after the request leaves), then restore the network and click 'Request cashout' again without changing the amount or type.
3. Via the API, reuse the idempotencyKey from step 2 with amount 250.
4. Check GET /campaigns/C1/payouts and the campaign balance document (pending and available).

**Expect:** Step 1 creates exactly one payout. The step 2 retry returns the same payout id (201 with the original row) and does not create a second one. The key reuse with a changed amount returns 409 'Request key already used with different details'. pendingBalance is cleared to available only once per payout, and there is no drift. The same holds on iOS.

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## PAYOUT-35 · P0 · Multiple pending requests exceeding eligible balance cannot overdraw

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** C1 is funded with eligible 1,000 and a bank recipient. Paystack test balance is sufficient.

**Steps:**

1. Request 800 Standard, then request another 800 Standard (the UI generates a new key after a success).
2. Admin A approves the first payout with a 20+ character review note.
3. Admin A approves the second.
4. Check the campaign balance and the breakdown.

**Expect:** Both requests are accepted as PENDING (source behavior: requests do not reserve funds). The first approval moves to PROCESSING. The second fails with 422 'Insufficient available balance to fund this payout', stays PENDING and no transfer is started. No balance field goes negative. Product should decide whether the second request should be blocked at request time.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

## PAYOUT-36 · P0 · Cashout to Ujimora Wallet: approval credits wallet with exact net

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** C1 is funded with eligible 1,000. Owner-U's GHS wallet balance is noted.

**Steps:**

1. In the cashout panel, set 'Receive funds in' to Ujimora Wallet and check that the info alert text is shown.
2. Request 500 Priority.
3. Admin A → Payouts: the card's destination review shows 'Ujimora Wallet belonging to campaign owner'. Enter a note and click Approve.
4. Owner-U opens /wallet and the cashout panel breakdown.

**Expect:** The payout has provider 'ujimora_wallet', fee 10.00 and net 490.00. After approval the status is PAID immediately (no Paystack call). The wallet balance goes up by exactly 490.00 with a completed deposit transaction. Campaign available goes down by 500, paidOut up by 490 and payoutFees up by 10. A second approval returns 409 'Payout cannot be approved in state PAID'. The automatic policy never auto-processes wallet payouts.

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`

## PAYOUT-37 · P0 · Admin approves single-transfer bank/MoMo payout end-to-end (Paystack test)

*Surfaces:* admin, api, email, web  ·  *Type:* functional

**Before:** PENDING standard payout of 300 on C1 to a bank recipient. The Paystack test webhook points to staging /api/v1/webhooks/paystack. 'Confirm transfers before sending' is OFF. Owner-U opted into 'Withdrawals and payouts' in-app and email alerts with a verified email. Resend is configured.

**Steps:**

1. Admin A opens Payouts (Queue view) and clicks 'Review payout destination' on the card. Check that the supplied name, provider name, full account number, bank code and type are shown.
2. Check that Approve is disabled with a note under 20 characters. Enter a 20+ character ownership review note and click Approve.
3. Wait for the transfer.success webhook (or click 'Check Paystack status').
4. Owner-U checks the cashout history, breakdown, in-app notifications and email inbox.
5. Inspect the ledger journal for externalRef pout:<id>:paid.

**Expect:** The notice reads 'Payout approved; the transfer is initiating.' The status goes PROCESSING with reference pout-<id>-xxxxxxxx, then PAID. The owner card shows Completed and 'Amount received GHS 300.00'. Balances: available −300, paidOut +300, payoutFees +0. Exactly one disbursement journal and settlementApplied true. An in-app alert and an email 'Your withdrawal is completed' link to /campaigns/C1, sent only after settlement is applied.

**Needs:** Paystack test keys and transfers enabled; Resend

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`

## PAYOUT-38 · P0 · Approval guards: short note, low Paystack balance, wrong state, non-admin, destination integrity

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Several PENDING payouts. A way to make the provider balance insufficient (a large amount above the test balance, or a live low-balance environment). Owner-U and Admin A tokens.

**Steps:**

1. POST /payouts/<id>/approve with a 10-character reviewNote.
2. Approve a payout whose net exceeds the Paystack balance.
3. Approve an already PROCESSING or PAID payout.
4. As Owner-U, POST /payouts/<id>/approve, GET /payouts, GET /payouts/review-queue and GET /payouts/<id>/recipient.
5. As Admin A, POST /campaigns/C1/payout-recipient for Owner-U's campaign (admin-created recipient). Then have Owner-U request a payout and have an admin approve it.

**Expect:** The short note gets a 400 validation error. Low balance gets 422 'Insufficient platform balance to fund this payout', the payout stays PENDING and no reservation is made. Wrong state gets 409 'Payout cannot be approved in state …'. The non-admin gets 403 everywhere. For the admin-created recipient, approval gets 409 'Payout destination changed; review it again before approving.' The owner must re-save the destination (a known operational trap).

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutRoutes.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`

## PAYOUT-39 · P0 · Segregation of duties: admin approving a payout on their own campaign

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Admin A also owns a funded campaign with a recipient. PAYOUT_DUAL_APPROVAL_AMOUNT=0 (production default).

**Steps:**

1. As Admin A in the web app, request a standard cashout of 100 on Admin A's campaign.
2. As Admin A in the admin console, approve that payout.

**Expect:** Control expectation: a staff member must not be able to approve their own payout. The source has no self-approval block (unlike KYC self-review), so the approval is expected to succeed today. If it does, record it as a launch-blocking finding, or enable dual approval and staff procedures before launch.

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`

## PAYOUT-40 · P0 · Dual approval (maker-checker) for high-value payouts

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** Staging PAYOUT_DUAL_APPROVAL_AMOUNT=100 (render.yaml ships 0 = disabled). Admin A and Admin B. PENDING payouts of 99.99, 100.00 and 150.00.

**Steps:**

1. Admin A approves the 99.99 payout with a note.
2. Admin A approves the 150.00 payout with a note.
3. Admin A tries to approve the 150.00 payout again.
4. Admin B opens the same card, checks the '1st approval: Admin A' label and the Maker-checker alert, enters their own note and clicks 'Give 2nd approval'.
5. Repeat steps 2 and 4 for the 100.00 payout.
6. Record the business decision on the production PAYOUT_DUAL_APPROVAL_AMOUNT.

**Expect:** 99.99 goes straight to PROCESSING. For 150.00, the first approval gives 'First approval recorded — a second admin must approve.' and the status stays PENDING with firstApprovedBy set. Admin A's repeat gets 409 'A second, different admin must approve this high-value payout'. Admin B's approval moves it to PROCESSING with approvedBy Admin B. 100.00 needs two approvals (the rule is ≥). Automatic payouts never process amounts at or above the threshold. The production threshold is signed off, not left at 0 by accident.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/admin/src/pages/PayoutsPage.tsx`, `render.yaml`, `apps/api/src/infrastructure/config/index.ts`

## PAYOUT-43 · P0 · Transfer webhook signature, replay and ordering idempotency

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Payout P1 PROCESSING. Payout P2 PROCESSING. A signing script: HMAC-SHA512 of the raw body with PAYSTACK_SECRET_KEY, sent in the x-paystack-signature header.

**Steps:**

1. POST a transfer.success body for P1's reference with a wrong signature.
2. POST a correctly signed transfer.success for P1, then the identical request twice more.
3. POST a signed transfer.failed for P1 (already PAID).
4. POST a signed transfer.failed for P2 twice.
5. Check the balances, journal count and owner history for both.

**Expect:** The wrong signature gets 401 'Invalid webhook signature' and no change. P1 becomes PAID once: one :paid journal, paidOut increased once, and the replays are no-ops. The late failed event does not change P1. P2 becomes FAILED once, and its reserved gross returns to available exactly once (settleRef pout:<id>:returned). The owner card shows Failed with 'Refresh your balance and check your destination before requesting again.' A fresh request with a new key is possible afterwards.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePaystackWebhookUseCase.ts`, `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PaystackWebhookController.ts`

## PAYOUT-44 · P0 · Reversed transfer after PAID returns funds and posts reversal journal

*Surfaces:* admin, api, email, web  ·  *Type:* recovery/idempotency

**Before:** Payout P3 is PAID (gross 1000, priority, fee 10, net 990).

**Steps:**

1. Send a signed transfer.reversed for P3's reference, then replay it.
2. Check the campaign balance (available, paidOut, payoutFees), the journals and the owner history card.
3. Check the in-app and email alerts.

**Expect:** P3 becomes REVERSED (reversedFrom PAID). paidOut goes down by 990 and available goes back up; confirm how the fee is treated matches the finance policy (reverseFromPaidOut receives both net and fee). One reversal journal pout:<id>:reversed, and the replay changes nothing. The owner card shows Reversed with 'The transfer was reversed. Refresh your balance before requesting again.' A 'Your withdrawal is reversed' alert is sent after settlement is applied.

**Needs:** Paystack test secret

**Source:** `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`, `apps/web/src/components/campaigns/PayoutHistoryCard.tsx`

## PAYOUT-45 · P0 · Missed webhook recovered by owner refresh, admin check, sweep and script

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** In the staging Paystack dashboard, temporarily point the webhook URL somewhere else. Staging NODE_ENV=production and PAYMENTS_RECONCILIATION_ENABLED=true (or use the manual endpoint).

**Steps:**

1. Approve a payout. The Paystack test transfer succeeds but no webhook arrives, so it stays PROCESSING.
2. As the owner, expand the cashout panel (which auto-calls POST /campaigns/:id/payouts/:pid/refresh). Call refresh again within 30 seconds.
3. For a second stuck payout, Admin clicks 'Check Paystack status'.
4. For a third, wait up to 5 minutes for the scheduled sweep, or POST /api/v1/admin/reconciliation/payouts {olderThanMinutes:1} as admin.
5. Run apps/api/scripts/reconcile-campaign-transfer.ts <payoutId> without --apply against a fourth.
6. Restore the webhook URL.

**Expect:** The owner refresh moves the payout to PAID. The second call inside the lease returns the stored row with nextCheckAt and no second provider call. The admin check gives 'Transfer status refreshed.' and PAID. The sweep or endpoint returns a summary with settled ≥ 1. The script without --apply is a dry run and changes nothing. Every path settles exactly once with no duplicate journals. A non-admin calling /admin/reconciliation/payouts gets 403.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/controllers/PayoutController.ts`, `apps/api/src/application/use-cases/PayoutTransferControlUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`, `apps/api/src/app.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/adminPaymentsRoutes.ts`, `docs/payments/automatic-payouts.md`

## PAYOUT-46 · P0 · Paystack OTP-confirmed transfer: authorize, resend, wrong OTP

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** In the Paystack test environment, 'Confirm transfers before sending' is ON. A PENDING payout.

**Steps:**

1. Approve the payout. Check that the admin card shows 'Awaiting Paystack authorization' with a Paystack OTP field, and that the owner card shows 'Awaiting authorization'.
2. Enter 5 digits (Authorize is disabled), then a wrong 6-digit code, and click 'Authorize existing transfer'.
3. Click 'Resend OTP'.
4. Enter the correct OTP and click Authorize.
5. POST transfer-control {action:'authorize', otp:'123456'} against a payout that is not awaiting OTP. As Owner-U, call transfer-control for any payout.

**Expect:** The wrong OTP shows an error and the payout stays PROCESSING/otp. Resend shows 'A new OTP was requested from Paystack.' The correct OTP finalizes the same transfer (no new transfer is created) and it becomes PAID after verification. Not-awaiting-OTP gets 409 'Transfer is no longer awaiting OTP. Refresh its status.' Owner-U gets 403. The OTP value does not appear in the logs or DB.

**Needs:** Paystack test keys with OTP enabled

**Source:** `apps/admin/src/components/PayoutTransferControls.tsx`, `apps/api/src/application/use-cases/PayoutTransferControlUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`

## PAYOUT-49 · P0 · Automatic payouts are OFF by default; policy form validation and history

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** A fresh staging DB with no AutomaticPayoutPolicy document. Admin A and Owner-U.

**Steps:**

1. Admin → Settings → Automatic payouts. Check the 'Enable automatic payouts' switch and the default limits.
2. As Owner-U, request a standard cashout of 100 and check the admin card reason.
3. Save a policy with maxAmount 2000 and dailyOwnerLimit 1000. Then save with mobileMoneyMaxAmount 600 and maxAmount 500.
4. Save a valid policy twice and GET /admin/automatic-payouts.
5. As Owner-U, call GET and PUT /admin/automatic-payouts.

**Expect:** The switch is off. Defaults are 500 max, 1000 owner/day, 5000 platform/day, 30-day bank review, 250 MoMo max and 24h MoMo review. The payout stays PENDING with automationReason 'Automatic payouts are disabled.' Invalid policies get 400 'Limits must increase from MoMo to per-request to owner/day to platform/day.' Valid saves increment revision and add history entries (by, at), capped at 100. Owner-U gets 403.

**Source:** `apps/admin/src/components/AutomaticPayoutSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/infrastructure/database/models/AutomaticPayoutModel.ts`

## PAYOUT-50 · P0 · Automatic payout eligible path processes immediately

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Policy enabled with defaults. Owner-U has a verified email, an approved non-expired identity (level 2) and a funded C1 with no open dispute. A bank recipient reviewed in the last 30 days with a provider-resolved name, and a previous manually approved PAID payout to that same recipient. Paystack OTP OFF.

**Steps:**

1. As Owner-U, request 200 Standard to Paystack.
2. Check the returned payout and the admin card.
3. Wait for the webhook.
4. Check the AutomaticPayoutBudget documents for today (owner and platform).

**Expect:** The response is already PROCESSING. approvedBy is 'system:auto-payout', shown as 'System automation'. automationReason reads 'Automatic policy vN: reviewed destination and limits passed.' Then PAID. Budget usedMinor goes up by 20000 on both the owner and platform keys. Variant with Owner-O: an organization owner needs level 3 plus a current business approval.

**Needs:** Paystack test keys

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PayoutController.ts`

## PAYOUT-51 · P0 · Automatic payout refusals fall back to manual review with correct reason

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** Policy enabled. The same eligible setup as PAYOUT-50, then change one condition per run.

**Steps:**

1. First payout to a new destination.
2. Amount 600 (above maxAmount 500).
3. Type priority, then an early request on a below-goal campaign.
4. Destination Ujimora Wallet.
5. MoMo recipient with 300 (above 250), then MoMo with a review older than 24 hours.
6. Open a dispute on the campaign.
7. Expired KYC (via the DB) and an unverified email.
8. Two requests of 600 and 500 that exceed the owner's 1000/day limit (with maxAmount set to 600).

**Expect:** Each request stays PENDING and shows its reason on the admin card: 'First payout to this destination requires manual review.', 'Amount exceeds automatic approval limits.', 'This destination or service requires manual review.', a manual reason for the wallet, 'Amount exceeds automatic MoMo limit.', 'Destination needs a current ownership review.', 'Campaign has an unresolved dispute.', 'Current owner identity or organization verification requires manual review.' or 'Owner verification is required.', and 'Automatic checks could not complete or a daily limit was reached. Manual review required.' The budget is not consumed for refused requests. All of them can still be approved manually.

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.ts`

## PAYOUT-53 · P0 · Creator withdrawal to name-matched saved account (web) — fee and settlement

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Creator-C on a paid plan with available tip balance GHS 200 (from web test tips) and a creator fee X% from /creators/me policy. A saved account with verificationStatus name_matched.

**Steps:**

1. Open /creator and click Withdraw. Choose 'Bank or mobile money' and the saved payout account, enter 100 and check the text 'Fee: GH₵… · You receive: GH₵…'.
2. Click Withdraw.
3. Check the Withdrawals list and GET /creators/me/payouts.
4. Wait for the transfer.success webhook for the cpay- reference.

**Expect:** The fee equals round(100 × X)/100 and the net equals 100 − fee, matching the server. The snack says 'Withdrawal started'. The payout is PROCESSING immediately with a cpay-<id>-xxxx reference and no admin approval step. After the webhook it is PAID. Creator balance: available −100, paidOut +net. An activity alert links to /creator.

**Needs:** Paystack test keys

**Source:** `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/creatorRoutes.ts`

## PAYOUT-54 · P0 · Creator withdrawal validation and fee-change guard

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Creator-C with available 200. One saved account that is needs_review and one that is name_matched.

**Steps:**

1. Withdraw 50 to the needs_review account.
2. Withdraw 250 (more than available).
3. Via the API, withdraw 10.005, then with no idempotencyKey.
4. Open the dialog, have an admin change the creator plan fee, then click Withdraw.
5. Withdraw an amount less than or equal to the fee.
6. Remove PAYSTACK_SECRET_KEY on staging and withdraw to a bank.

**Expect:** needs_review gets 422 'This payout account needs verification. Choose an account with a matched registered name...'. Over balance gets 400 'Insufficient available balance for this withdrawal.' 10.005 gets 400 'Enter a withdrawal amount.' No key gets 422 'A transfer request key is required'. The fee change gets 409 'Your withdrawal fee has changed. Refresh your creator dashboard and review the new fee.' Amount ≤ fee gets 422 'The withdrawal amount must exceed the fee.' No Paystack gets 503 'Withdrawals are not available right now.' The balance is unchanged after every failure.

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`

## PAYOUT-55 · P0 · Creator withdrawal idempotency, replay ownership and failure restoration

*Surfaces:* api, ios, web  ·  *Type:* recovery/idempotency

**Before:** Creator-C with available 200. Other-U is also a creator. Signing script.

**Steps:**

1. Double-tap Withdraw for 50, or retry after dropping the network mid-request.
2. As Other-U, POST /creators/withdraw reusing Creator-C's idempotencyKey.
3. Send a signed transfer.failed for the cpay- reference, then replay it.
4. Block Paystack /transfer so the outcome is unknown, withdraw 30, then unblock and reconcile.

**Expect:** Only one withdrawal exists per key and the retry returns the same record. Other-U gets 409 'This withdrawal request key is unavailable. Start a new withdrawal request.' The failed event gives FAILED and returns 50 to available exactly once. The unknown outcome stays PROCESSING with the reservation kept and is resolved by reconciliation, with no double payment.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/api/src/application/use-cases/HandleCreatorPayoutWebhookUseCase.ts`, `apps/api/src/application/use-cases/ReconcilePayoutsUseCase.ts`

## PAYOUT-57 · P0 · KYC enforcement on money-out paths (manual cashout and creator withdrawal)

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Owner-U whose identity approval has expired (set in the DB) and who has a funded campaign and recipient. Creator-U2 with a tip balance and a name-matched account but no KYC at all.

**Steps:**

1. As Owner-U, request a standard cashout of 100 and check whether the web shows any KYC prompt.
2. Admin opens the payout card and looks for any owner KYC status. Approve it.
3. As Creator-U2, withdraw 50 to the bank account.

**Expect:** Policy expectation, per APP_REVIEW_NOTES ('KYC is only needed to create campaigns or withdraw funds') and READINESS C13: money-out needs current KYC. Current source enforces KYC only on automatic payouts, so the manual request and approval and the creator withdrawal are expected to succeed. If they do, raise a P0 launch decision: add a KYC gate, or document the manual-review control and update the store notes.

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/RequestCreatorWithdrawalUseCase.ts`, `apps/mobile/APP_REVIEW_NOTES.md`, `docs/compliance/READINESS.md`

## PAYOUT-58 · P0 · Campaign cashout on iOS and Android (in-app, no Safari hand-off)

*Surfaces:* android, api, ios  ·  *Type:* cross-platform

**Before:** Physical devices. Owner-U has funded C1 with a saved account.

**Steps:**

1. Open the campaign and tap 'Manage campaign'. The cashout panel loads the eligible balance and breakdown.
2. Pick a saved account and tap save. Choose a service, use 25%, 50% and Max, and check the quote.
3. Tap 'Request cashout'. Background the app and return (an AppState refresh). Tap 'Refresh payout details'.
4. Have an admin approve it, then foreground the app.

**Expect:** The whole flow stays in-app on iOS (a payout is not a purchase, so no Safari or IAP). Values match the web for the same campaign. The request is created once, even with a double tap (idempotency key via expo-crypto). The history card moves from Awaiting review to Processing to Completed after refreshes. Keyboard insets do not hide the button.

**Needs:** Paystack test keys; physical devices

**Source:** `apps/mobile/src/components/CampaignCashout.tsx`, `apps/mobile/app/campaign/manage.tsx`, `apps/mobile/src/components/PayoutHistoryCard.tsx`

## PAYOUT-02 · P1 · Identity KYC with passport and document address proof (non-Ghana address)

*Surfaces:* api, web  ·  *Type:* functional

**Before:** Other-U with no KYC. A passport photo-page image and a utility bill PDF.

**Steps:**

1. Open /kyc. Complete Step 1 and click Next.
2. Step 2: set 'Identity document type' to Passport. Confirm there is only a 'Passport photo page' upload and no Back side. Upload the image and click Next.
3. Step 3: change Country to Nigeria. Confirm the GhanaPost GPS toggle disappears. Pick a state and city, enter a street address and optional postal code, and upload the utility bill PDF as 'Address proof'. Click Next.
4. Step 4: upload the selfie, tick the acknowledgement and submit.
5. Inspect the POST /kyc/identity request payload in DevTools.

**Expect:** The payload has proofMethod 'document', street and postalCode, and no gpsAddress. Documents are exactly [passport, utility_bill, selfie]. The API returns 201. Going back to Step 2 and switching the type back to ID card clears the passport and selfie uploads, as the helper text 'Changing the type clears the previous ID images and selfie' says.

**Needs:** Cloudinary

**Source:** `apps/web/src/pages/KYCPage.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`

## PAYOUT-03 · P1 · KYC wizard client-side validation messages

*Surfaces:* android, ios, web  ·  *Type:* negative/edge

**Before:** A signed-in user with no pending KYC.

**Steps:**

1. Web /kyc Step 1: leave the name blank and click Next. Then enter a date of birth 17 years ago. Then clear Nationality.
2. Step 2: upload only the front of an ID card and click Next.
3. Step 3: for Ghana, enter GPS 'GA-18-816' and click Next. Switch to 'Upload document' and click Next without a street or file.
4. Step 4: click 'Submit Verification' without a selfie, then with a selfie but without the acknowledgement.
5. Repeat on iOS and Android via Profile → Verification → start verification (app/kyc.tsx).

**Expect:** The web shows these messages in turn: 'Enter your full name and ID number.', the adult-age error, 'Select your nationality from the list.', 'Upload the front and back of your ID.', 'Enter a GhanaPost GPS address, for example GA-183-8164.', 'Enter your street address and upload proof of address.', 'Upload a clear selfie holding your ID.' and the acknowledgement message. Mobile shows the equivalent validateKycStep messages in a Snackbar, and 'Submit verification' is disabled until the acknowledgement is ticked. No POST /kyc/identity is sent while any error remains.

**Source:** `apps/web/src/pages/KYCPage.tsx`, `apps/mobile/app/kyc.tsx`, `apps/mobile/src/lib/kyc.ts`

## PAYOUT-06 · P1 · Duplicate or concurrent KYC submission yields a single active application

*Surfaces:* api, web  ·  *Type:* recovery/idempotency

**Before:** New-U with no pending identity record. A complete wizard filled in two browser tabs.

**Steps:**

1. In tab A and tab B, reach Step 4 with valid uploads.
2. Click 'Submit Verification' in both tabs as close together as possible (or send two identical POST /kyc/identity calls in parallel).
3. Reload /kyc and submit the wizard a third time.
4. Check GET /kyc/status.

**Expect:** One submission returns 201 and the other returns 409 'You already have a pending identity verification'. The third attempt also returns 409, shown as the red error text on Step 4. /kyc/status lists exactly one pending identity record.

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`, `apps/api/src/application/use-cases/SubmitKYCIdentityUseCase.ts`

## PAYOUT-10 · P1 · KYB validation and role enforcement

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Owner-O (organization) and Owner-U (individual).

**Steps:**

1. As Owner-O, submit with the authorization document missing, then with a 10-character ownership explanation, then with a 120% ownership share, then with a representative under 18.
2. Make the network request fail during submit (DevTools offline) and check that the entries are preserved.
3. As Owner-U (individual), POST /api/v1/kyc/business with a structurally valid body.
4. As Owner-O while a business application is pending, submit again.
5. POST /kyc/business with documents that lack business_registration.

**Expect:** The client errors are: 'Upload registration, authorization and representative identity evidence.', 'Explain ownership and control in at least 20 characters.', 'Ownership percentages must be between 0 and 100.', and the age error. The offline failure keeps all entries. The individual account gets 403 'Organization verification requires an organization account.' The duplicate gets 409 'An organization verification is already under review.' Missing registration evidence gets 422 'Provide registration evidence, representative authorization and the representative identity document.'

**Source:** `apps/web/src/components/OrganizationKYCForm.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycBusinessRoutes.ts`

## PAYOUT-11 · P1 · Organization KYB on iOS and Android

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** An organization account on physical devices. The PDFs are in device storage.

**Steps:**

1. Profile → Verification → start. Confirm the organization form (OrganizationKYCForm) shows.
2. Fill in all fields, add and remove a controlling person, and upload the documents via the document picker.
3. Turn on airplane mode and submit, then turn it off and resubmit.

**Expect:** Field parity with web. The offline submit shows an error and keeps the entries. The retry succeeds with one pending business application (no duplicates). Declarations are required. The scroll and keyboard do not hide the submit button.

**Needs:** Cloudinary

**Source:** `apps/mobile/src/components/OrganizationKYCForm.tsx`, `apps/mobile/src/lib/organizationKyc.ts`

## PAYOUT-17 · P1 · Information-response edge cases and stale staff review

*Surfaces:* admin, api, web  ·  *Type:* negative/edge

**Before:** New-U's application is in_review with an open request. Admin A has the queue open, loaded before the applicant responds.

**Steps:**

1. As New-U, POST /kyc/<id>/respond-info with a kyc:// document owned by Other-U.
2. Submit a valid response from two tabs at the same time.
3. As Other-U, POST respond-info against New-U's verification id.
4. Without refreshing, Admin A clicks Approve (using the old reviewVersion).
5. Admin A clicks 'Refresh queue', re-attests and approves.

**Expect:** The foreign document gets 400 'Upload each document through your private document uploader.' The concurrent responses give one success and one 409 'This information request is no longer awaiting a response.' Other-U gets 404 'Verification not found.' The stale approval gets 409 'This application has changed. Refresh the queue and review the latest evidence before saving.' After refreshing, the approval succeeds.

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/kycInformationRoutes.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`

## PAYOUT-18 · P1 · Concurrent conflicting staff decisions

*Surfaces:* admin, api  ·  *Type:* recovery/idempotency

**Before:** Admin A and Admin B are on different machines with the same pending application open.

**Steps:**

1. Admin A clicks Approve (attested) and Admin B clicks 'Save rejection' within about 1 second.
2. Refresh both consoles and check the Audit Log.

**Expect:** Exactly one decision commits. The other admin gets 409 ('This verification already has a decision.' or a version conflict) and sees an error instead of optimistic success. There is exactly one kyc.approved or kyc.rejected audit entry. The verification level changes only if the approval won.

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.ts`

## PAYOUT-22 · P1 · Renewal: early resubmission while approval still valid, and renewal after expiry

*Surfaces:* admin, api, ios, web  ·  *Type:* negative/edge

**Before:** Owner-U has a valid (not expired) approved identity. A second user has an expired identity (from PAYOUT-21).

**Steps:**

1. As Owner-U, submit a new identity application from /kyc while the current approval is valid.
2. Check /kyc/status, the public badge, campaign creation, and automatic payout eligibility.
3. As an admin, approve the renewal.
4. For the expired user, tap 'Renew verification' on mobile, submit, have an admin approve, and recheck the badge and allowance.

**Expect:** Per the current source, the newest record wins. While the early renewal is pending, kycStatus shows Pending and the public level, campaign allowance and automatic payout eligibility fall back until approval. Confirm with product that this is intended; if not, log a defect. After approval there is a new expiry of approval + 365 days and privileges are restored. The expired user's renewal restores the badge and allowance after approval.

**Source:** `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/domain/services/currentVerificationLevel.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCRepository.ts`

## PAYOUT-23 · P1 · Verification level and badge consistency across web, iOS, Android

*Surfaces:* android, api, ios, web  ·  *Type:* cross-platform

**Before:** Four users: New-U (none, pending), Owner-U (identity approved), Owner-O (business approved), and a user with a rejected latest record.

**Steps:**

1. For each user, view the public profile, the campaign-page organizer TrustBadge (web CampaignOrganizer, mobile campaign/[id]) and the org listing on web, iOS and Android.
2. View the web /profile KYC Status card (Level x/3 and the 'needed' list) for Owner-U.

**Expect:** The labels match the current evidence: Unverified or Basic, Verified (2), Institutional (3). A rejected newest record does not show Verified. Known UX risk to verify: an individual's KYC Status card can never reach Level 2 'FULL' because no address-only submission exists, and it lists 'Business verification (optional)', which individuals cannot submit (403). Record this as a UX defect or a decision.

**Source:** `apps/web/src/components/KYCStatus.tsx`, `apps/mobile/src/components/TrustBadge.tsx`, `apps/web/src/components/campaigns/CampaignOrganizer.tsx`, `apps/api/src/application/use-cases/GetPublicUserProfileUseCase.ts`

## PAYOUT-25 · P1 · Add bank (GhIPSS) account with name mismatch; plan account limit

*Surfaces:* android, api, ios, web  ·  *Type:* negative/edge

**Before:** Owner-U on the Free plan already has 1 saved account. A Pro-plan user has 2 accounts.

**Steps:**

1. As Owner-U, add a second distinct bank account.
2. Remove the existing account ('Remove saved account'), then add the bank account with an account name that deliberately differs from the bank's registered name.
3. As the Pro user, add accounts until the limit of 3, then try a 4th. Add two different accounts from two tabs at the same time when one slot is left.
4. Repeat an add and a remove on mobile Profile → Payout accounts.

**Expect:** Owner-U's second account gets 403 'Your Free plan allows 1 payout account(s). Remove an unused account or upgrade.' Removal shows 'Removed from saved accounts. Existing payout requests keep their original destination.' The mismatched name shows 'Ownership review at cashout' (needs_review). The Pro user's 4th account is refused, and the concurrent adds give one success and one 409 'Your payout account limit was reached. Refresh your accounts.' Mobile has the same behavior.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.ts`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`

## PAYOUT-26 · P1 · Saved payout accounts are private to their owner

*Surfaces:* api  ·  *Type:* security/permission

**Before:** Owner-U has saved account id S. Other-U owns campaign C2.

**Steps:**

1. As Other-U, call DELETE /payout-accounts/S.
2. As Other-U, POST /campaigns/C2/payout-recipient {savedAccountId:S}.
3. As Owner-U, GET /payout-accounts and inspect the fields.
4. Call GET /payout-accounts logged out.

**Expect:** The delete returns 404 'Payout account not found' and S is untouched. The recipient call returns 404. The list exposes only id, type, accountName, last4, bankCode, verificationStatus and resolvedAccountName, never the full account number or recipientCode. Logged out gets 401.

**Source:** `apps/api/src/application/services/PayoutAccountService.ts`, `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`

## PAYOUT-32 · P1 · 25% / 50% / Max amount shortcuts and rounding

*Surfaces:* android, ios, web  ·  *Type:* functional

**Before:** C1 is funded with eligible GHS 1,000.00. C3 is funded with eligible GHS 333.33.

**Steps:**

1. On C1 with Standard, click 25%, 50% and Max and check the amount field and the pressed state (aria-pressed on web).
2. Switch to Urgent on C2 (below goal, eligible 1,000) and click 25%, 50% and Max.
3. On C3, click Max with Standard and submit.
4. Repeat on iOS and Android.

**Expect:** C1 gives 250.00, 500.00 and 1000.00. Urgent on C2 gives 200.00, 400.00 and 800.00 (80% cap). C3's Max gives 333.33 and the API accepts it exactly (no 'only GHS … available' error from rounding). The shortcut buttons are disabled when eligible is 0. Mobile matches web.

**Source:** `apps/web/src/components/campaigns/CampaignCashout.tsx`, `apps/mobile/src/components/CampaignCashout.tsx`

## PAYOUT-41 · P1 · Batched payout above single-transfer ceiling (legs, partial failure)

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** Staging PAYOUT_MAX_TRANSFER_AMOUNT=100. Standard PENDING payouts to a bank recipient of 250.50 and 200.50. The ability to send signed per-leg webhooks.

**Steps:**

1. Approve the 250.50 payout and check the admin card 'Legs' detail and the payout legs in the DB.
2. Send transfer.success for all legs and check the status.
3. Approve the 200.50 payout and check the leg amounts.
4. Send transfer.success for legs 0 and 1 and transfer.failed for leg 2.
5. Check the campaign available balance and the admin card alert.

**Expect:** 250.50 splits into legs [100.00, 100.00, 50.50] (sum equals net), each with its own reference pout-<id>-L<n>-xxxx, and becomes PAID after all succeed. 200.50 splits into [100.00, 99.50, 1.00], with no leg under GHS 1. The partial failure ends as NEEDS_REVIEW with the 'Partially settled — some transfer legs failed...' alert. Only the failed leg's 1.00 goes back to available, and only once. Transfer controls are hidden for batched payouts.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/services/payoutBatch.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/application/use-cases/HandlePayoutWebhookUseCase.ts`

## PAYOUT-42 · P1 · Batching refusals for MoMo and expedited payouts over ceiling

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** Staging PAYOUT_MAX_TRANSFER_AMOUNT=100. A PENDING standard payout of 150 to a MoMo recipient, and a PENDING priority payout of 300 to a bank recipient.

**Steps:**

1. Approve the MoMo payout with a note.
2. Approve the priority payout.

**Expect:** The MoMo payout gets 422 'This payout exceeds the single-transfer ceiling. Use a verified bank account or arrange a reviewed payout amount; MoMo transfers are not automatically split...'. The priority payout gets 422 'Expedited payouts above the GHS 100 single-transfer ceiling require the higher-limit arrangement — request a standard payout instead'. Both stay PENDING with no reservation.

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`

## PAYOUT-47 · P1 · Transfer initiation failure vs unknown outcome (funds never stranded or double-sent)

*Surfaces:* admin, api, web  ·  *Type:* recovery/idempotency

**Before:** Staging with the ability to block outbound calls to api.paystack.co for about 30 seconds (firewall or proxy). A recipient code that Paystack rejects (for example an invalid test account).

**Steps:**

1. Approve a payout to the invalid recipient.
2. Approve a payout while outbound calls to Paystack /transfer are blocked or timed out.
3. Try to approve the second payout again, then unblock and run 'Check Paystack status' or reconciliation.

**Expect:** Provider rejection: the admin gets 502 'Payout transfer was rejected by the provider', the payout becomes FAILED and the gross returns to available once. Unknown outcome: the admin gets 502 with the outcome-unknown message, the payout stays PROCESSING with funds still reserved (no rollback), and re-approval gets 409 because it is not PENDING. Reconciliation later resolves it to PAID or FAILED. No duplicate transfer exists in the Paystack dashboard.

**Needs:** Paystack test keys; network control

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/domain/errors/TransferOutcomeUnknownError.ts`

## PAYOUT-48 · P1 · Paystack transfer-approval callback is signed and exact-match

*Surfaces:* api  ·  *Type:* security/permission

**Before:** PAYSTACK_APPROVAL_REQUIRE_SIGNATURE=true. Payout P4 is PROCESSING with a known reference, net 50.00 and recipient code RCP_x. Signing script.

**Steps:**

1. POST /api/v1/payouts/paystack-approval unsigned with a correct body.
2. POST signed {reference, amount:5000, currency:'GHS', recipient:{recipient_code:'RCP_x'}}.
3. POST signed with amount 5001, then with currency 'NGN', then with an unknown reference.
4. Check the Paystack dashboard Transfer Approval setting.

**Expect:** Unsigned gets 400. The exact match gets 200. Every mismatch gets 400. No transfer or ledger change results from these calls. The Transfer Approval URL is enabled in the Paystack dashboard only after this passes in the sandbox; otherwise it is confirmed disabled.

**Needs:** Paystack test secret

**Source:** `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `docs/payments/automatic-payouts.md`

## PAYOUT-52 · P1 · Automatic payout daily budgets under concurrency

*Surfaces:* api  ·  *Type:* recovery/idempotency

**Before:** Policy enabled with maxAmount 500, dailyOwnerLimit 1000 and dailyPlatformLimit 1200. Two eligible owners (A and B).

**Steps:**

1. Fire 4 concurrent requests of 400 each from owner A with different idempotency keys.
2. Fire 2 concurrent requests of 400 from owner B.
3. Check the statuses and budget documents.

**Expect:** Owner A has at most 2 auto-processed (800 ≤ 1000) and the rest stay PENDING. Platform-wide auto-processed never exceeds 1200. usedMinor never goes over the limit. If an auto attempt fails at the provider, the budget stays consumed (by design) and the reason reads 'Automatic initiation needs attention...'.

**Source:** `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`

## PAYOUT-56 · P1 · Creator withdrawal to Ujimora Wallet

*Surfaces:* android, api, ios, web  ·  *Type:* functional

**Before:** Creator-C with available 100 and fee X%.

**Steps:**

1. In the Withdraw dialog, choose 'Ujimora Wallet', enter 100 and confirm.
2. Open /wallet (web) and the Wallet screen (mobile).

**Expect:** The snack says 'Funds added to your Ujimora Wallet'. The wallet is credited with exactly the net (100 − fee) at once, as a completed deposit transaction. Creator available −100. A retry with the same key does not credit twice.

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.ts`, `apps/web/src/pages/CreatorDashboardPage.tsx`, `apps/mobile/app/creator.tsx`

## PAYOUT-59 · P1 · Mobile payout accounts screen and creator withdrawal dialog

*Surfaces:* android, ios  ·  *Type:* cross-platform

**Before:** Creator-C and Owner-U on devices.

**Steps:**

1. Profile tab → Payout accounts: add a MoMo account, check the name-match state, remove it, and hit the plan limit.
2. Pick a campaign under the campaign selector and save its destination.
3. Creator page → Withdraw: enter an amount, choose a saved account or 'Use entered account', and submit.
4. Confirm no store purchase sheet appears and that tips purchase flows are not offered in-app.

**Expect:** Parity with web behavior and messages. The withdrawal is created and history shows under Withdrawals. No IAP prompt for withdrawals. Creator tips stay unavailable in native apps (store decision) while withdrawing an existing balance works.

**Needs:** Paystack test keys

**Source:** `apps/mobile/app/payout-accounts.tsx`, `apps/mobile/src/components/SavedPayoutAccounts.tsx`, `apps/mobile/src/components/PayoutAccounts.tsx`, `apps/mobile/app/creator.tsx`

## PAYOUT-60 · P1 · Payout activity alerts (in-app and email) respect preferences

*Surfaces:* api, email, web  ·  *Type:* functional

**Before:** Owner-U with a verified email. Settings → Activity alerts 'Withdrawals and payouts' with in-app ON and email ON. Resend configured. A second owner with the category OFF.

**Steps:**

1. Create a payout, then approve it, then settle it as PAID via webhook. Separately take one to FAILED and one to REVERSED.
2. Check the web dashboard notifications and the mailbox for both owners.
3. Unverify the email (or use an unverified account) and check that the email toggle is disabled.

**Expect:** Alerts are titled 'Your withdrawal is requested', '...processing', '...completed', '...failed' and '...reversed', each linking to /campaigns/<id>. PAID and REVERSED appear only after settlement is applied. The owner with the category OFF gets none. Unverified email means no email and the toggle is disabled. No duplicates on webhook replay.

**Needs:** Resend

**Source:** `apps/api/src/infrastructure/adapters/outbound/persistence/MongoActivityAlerts.ts`, `apps/web/src/components/account/ActivityAlertSettings.tsx`, `packages/types/src/activity-alerts.ts`

## PAYOUT-61 · P1 · Owner balance breakdown reconciles through payout lifecycle

*Surfaces:* api, web  ·  *Type:* functional

**Before:** C1 with known settled donations (sum of gross, platform fees and processor fees recorded), plus one tip to Ujimora.

**Steps:**

1. Record every breakdown row before any payout.
2. Request and approve 300 priority (fee 10), and record the rows while it is PROCESSING.
3. Settle it as PAID and record the rows.
4. Take a second payout of 100 to FAILED and record the rows.

**Expect:** netProceeds = raised − platformFees − processorFees. While PROCESSING, reservedOrAdjustments = 300 (in transit). After PAID, paidOut +290, payoutFees +10 and reservedOrAdjustments back to 0. After FAILED, eligible is restored. Optional tips are shown separately and excluded from eligible. No 'campaign total and accounted donations differ' warning for clean data. The locked plan rate is shown.

**Source:** `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`, `apps/web/src/components/campaigns/CampaignCashout.tsx`, `packages/types/src/payout.ts`

## PAYOUT-62 · P1 · Admin Payouts page views, labels, export, refresh and RBAC

*Surfaces:* admin  ·  *Type:* functional

**Before:** A mix of PENDING, PROCESSING, PAID, FAILED and NEEDS_REVIEW payouts, including one auto-processed. A staff role lacking the donations permission.

**Steps:**

1. Open /payouts. Check that the Queue view lists only PENDING, PROCESSING and NEEDS_REVIEW, and the counters 'Awaiting approval' and 'Needs review'.
2. Switch to All and Beneficiary (?view=all and ?view=beneficiary).
3. Check campaign titles, 'System automation' for auto approvals, and the Technical details reference and transfer code.
4. Export and check the Gross/Fee/Net columns.
5. Wait 30 seconds or refocus the tab and check the list refreshes.
6. Sign in as the restricted staff user and open /payouts.

**Expect:** The views and counters are correct. The export matches the DB values. Auto-refresh works. The restricted staff user is blocked by RequirePermission. API calls by any non-admin role return 403.

**Source:** `apps/admin/src/pages/PayoutsPage.tsx`, `apps/admin/src/router.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/controllers/PayoutController.ts`

## PAYOUT-63 · P1 · Commercial-config fee override changes quotes and new payouts only

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** An existing PENDING early payout with fee 20 on 1000.

**Steps:**

1. Admin → Settings → Early cashout surcharge: change it from 1.0 to 2.0 and save. Also try 150.
2. The owner reloads the cashout panel and quotes early 1000.
3. Submit a new early 1000.
4. Approve the older PENDING payout.

**Expect:** 150 is rejected with 400 'Percentage cannot exceed 100.' The new quote and the new payout fee are 20.00 (2% of 1000 = 20, equal to the min 20). Check a larger amount too: 3000 gives 60. The existing payout keeps its recorded fee of 20 and its net at approval. Restore 1.0 afterwards.

**Source:** `apps/admin/src/components/EarlyCashoutSettings.tsx`, `apps/api/src/infrastructure/adapters/inbound/http/routes/commercialConfigRoutes.ts`, `apps/api/src/application/services/CommercialConfigService.ts`

## PAYOUT-64 · P1 · Payouts unconfigured (no Paystack key): wallet still works, bank path fails cleanly

*Surfaces:* api, web  ·  *Type:* negative/edge

**Before:** Staging with PAYSTACK_SECRET_KEY blank.

**Steps:**

1. In the cashout panel, click 'Verify & save payout account'.
2. Request a bank cashout via the API.
3. Request a Ujimora Wallet cashout and have an admin approve it.
4. Add a saved payout account at /payout-accounts.

**Expect:** Save recipient gets 501 'Payouts are not configured'. The bank payout request gets 501. The wallet cashout succeeds and is credited on approval. No 500 errors appear, and the UI shows the message in an error alert with Retry.

**Source:** `apps/api/src/application/use-cases/CreatePayoutRecipientUseCase.ts`, `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`

## PAYOUT-65 · P1 · Split-proceeds campaign blocks ordinary cashout; beneficiary KYC gate

*Surfaces:* admin, api, web  ·  *Type:* functional

**Before:** SPLIT_PROCEEDS_ENABLED=true on staging (production is off). Campaign C5 with an active split, a beneficiary recipient and balance.

**Steps:**

1. As the owner, POST /campaigns/C5/payouts {amount:50}.
2. Request a beneficiary payout. Admin → Payouts → Beneficiary view → Approve before verifying KYC.
3. Click verify KYC for the beneficiary, then approve.
4. Set SPLIT_PROCEEDS_ENABLED=false and repeat step 1.

**Expect:** With the flag on, the campaign payout gets 409 'This campaign shares proceeds; request per-beneficiary payouts instead'. Approving before verification gets 422 'Beneficiary KYC must be verified before payout'. After verification the approval proceeds, and dual approval applies if a threshold is set. With the flag off, the ordinary cashout is accepted.

**Needs:** Paystack test keys

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/BeneficiaryPayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/beneficiaryPayoutRoutes.ts`

## PAYOUT-67 · P1 · Cashout on suspended campaign or campaign with open dispute (manual path)

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** C7 has been suspended or rejected by moderation and has an eligible balance. C8 has an open dispute. Both have recipients.

**Steps:**

1. As the owner, request a cashout on C7 and on C8.
2. Admin approves both.

**Expect:** Policy expectation: payouts on suspended campaigns or campaigns with open disputes are blocked or held. The source checks disputes and status only on the automatic path, so manual requests and approvals are expected to go through. Record the outcome and get a product/compliance decision before launch.

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.ts`

## PAYOUT-70 · P1 · Staff account hardening before launch (MFA for all payout/KYC approvers)

*Surfaces:* admin, api  ·  *Type:* security/permission

**Before:** The list of all role=admin accounts in production.

**Steps:**

1. For each admin, check that MFA is enrolled (admin Profile → MFA) and that sign-in to admin.ujimora.com asks for a six-digit code.
2. Rotate one admin's password and check that the old admin session cannot approve a payout or KYC (authVersion fencing).

**Expect:** Every approver has MFA on (it is optional by default, so this is a procedural gate). After a credential rotation, approvals from the old session fail with 403 'Current administrator access is required.' or 401.

**Source:** `apps/api/src/application/use-cases/LoginUserUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`, `docs/compliance/MFA_AND_BIOMETRICS.md`

## PAYOUT-71 · P1 · KYC and payout data exposure and caching

*Surfaces:* admin, api, web  ·  *Type:* compliance

**Before:** Approved and rejected KYC records. Payouts with recipients.

**Steps:**

1. As an applicant, GET /kyc/status and look for reviewNotes, reviewedBy, idNumber or document URLs from other users.
2. GET /api/v1/users/<id> (public) and the organization pages, and look for KYC fields.
3. Check the response headers on /kyc/status, /kyc/pending, /kyc/business and /uploads/kyc/:id/access.
4. As the owner, GET /campaigns/:id/payout-options and check the recipient fields.
5. Grep the API logs for OTP values and full account numbers after running PAYOUT-37 and PAYOUT-46.

**Expect:** The applicant DTO has no reviewNotes or reviewedBy; rejectionReason appears only for rejected records. Public endpoints expose no KYC data. The headers are Cache-Control private, no-store. payout-options shows only last4 and names. The logs contain no OTPs and no full account numbers.

**Source:** `apps/api/src/application/use-cases/GetKYCStatusUseCase.ts`, `apps/api/src/application/use-cases/GetCampaignPayoutOptionsUseCase.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/kycRoutes.ts`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`

## PAYOUT-20 · P2 · Admin KYC queue: filters, export, counters, Verifications deep link

*Surfaces:* admin, api  ·  *Type:* functional

**Before:** At least 15 pending applications (identity and business), plus 1 approved and 1 rejected today.

**Steps:**

1. On /kyc-review, use the Status filter (pending, approved, rejected, expired), the Type filter, search by application ID and name, and pagination.
2. Note the 'Approved Today' and 'Rejected Today' counters, then reload the page.
3. Export the queue and open the file.
4. On /verifications, click the review button for a pending item.
5. Compare with GET /kyc/stats.

**Expect:** Filters and search behave correctly. The export has ID, Account, Name, Type, Status, Risk and dates, with no ID numbers or document URLs. The Verifications button opens /kyc-review?application=<id> focused on that application. Risk to verify: the counters and the approved/rejected/expired filters are computed from /kyc/pending, which returns only pending and in_review records, so after a reload they may show 0 or empty while /kyc/stats reports the real numbers. Log this as a defect if it happens.

**Source:** `apps/admin/src/pages/KYCReviewPage.tsx`, `apps/admin/src/pages/VerificationsPage.tsx`, `apps/api/src/application/use-cases/GetPendingKYCUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoKYCRepository.ts`

## PAYOUT-66 · P2 · Campaign eligibility changes between request and approval

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** C6 has just reached its goal and is still before its end date. A standard payout of 100 is PENDING.

**Steps:**

1. Refund one donation so raised drops below goal (via the refunds flow).
2. Admin approves the pending standard payout.
3. The owner submits an early request instead, and the admin approves it.

**Expect:** The standard approval gets 409 'Campaign eligibility changed. Request early cashout and review its additional fee.' (or 422 'Early cashout requires an early or urgent request...'). No reservation. The early request is approved with its fee.

**Source:** `apps/api/src/application/use-cases/ApprovePayoutUseCase.ts`, `apps/api/src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.ts`

## PAYOUT-68 · P2 · Payout fee coupon (API-only surface)

*Surfaces:* api  ·  *Type:* functional

**Before:** An active PAYOUT_FEE-surface coupon (for example 50% off, per-user limit 1) created in admin Coupons. C1 is funded.

**Steps:**

1. POST /campaigns/C1/payouts {amount:1000, type:'standard', couponCode:'X', idempotencyKey}.
2. POST priority 5000 with couponCode X.
3. Repeat a new priority request with X.
4. Send a request with X that fails a later check (for example amount over eligible).

**Expect:** Standard gets 422 'There is no fee on this payout to discount'. Priority 5000 has fee 25 reduced to 12.50, net 4,987.50 and a consumed redemption. The second use gets 422 'You have already used this coupon the maximum number of times'. A failed request does not burn a redemption. The web and mobile UIs do not expose a coupon field; confirm this is intended.

**Source:** `apps/api/src/application/use-cases/RequestPayoutUseCase.ts`, `apps/api/src/application/services/CouponService.ts`

## PAYOUT-69 · P2 · Rate limiting on payout-account, recipient and transfer-control endpoints

*Surfaces:* admin, api  ·  *Type:* negative/edge

**Before:** One IP. A script able to send 70 requests.

**Steps:**

1. Send 61 POST /payout-accounts requests within 15 minutes.
2. From the same IP, click 'Check Paystack status' in admin.
3. Send 61 POST /campaigns/:id/payout-recipient requests.

**Expect:** Request 61 and later get 429. Check whether the admin transfer-control shares the 'donation-intent' limiter scope with member endpoints from the same IP; if an admin is throttled by member traffic, log it. Normal usage stays unaffected.

**Source:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/automaticPayoutRoutes.ts`, `apps/api/src/infrastructure/adapters/inbound/http/routes/payoutAccountRoutes.ts`

## PAYOUT-72 · P2 · Legacy public KYC document links flagged in admin review

*Surfaces:* admin  ·  *Type:* compliance

**Before:** A KYC record in staging whose document url is a legacy https Cloudinary public URL (imported or seeded).

**Steps:**

1. Open the application in the /kyc-review detail.

**Expect:** The preview shows the warning 'Legacy document link. This file needs migration to authenticated storage and public-link invalidation.' Approval is refused with 422 because the document is not a current private upload, and the admin must request new evidence. Confirm the count of legacy assets against the PRIVATE_KYC_ROLLOUT release gate.

**Source:** `apps/admin/src/components/kyc/KYCDocumentPreview.tsx`, `apps/api/src/infrastructure/adapters/outbound/persistence/lockPrivateKycDocuments.ts`, `docs/compliance/PRIVATE_KYC_ROLLOUT.md`
