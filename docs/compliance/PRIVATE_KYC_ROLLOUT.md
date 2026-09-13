# Private verification documents

Engineering status: new-upload protection implemented; legacy migration and production verification remain open. Do not publish a claim that all verification documents are private until the checks below are evidenced.

## New uploads

`POST /uploads/image?folder=kyc` signs Cloudinary uploads with `type=authenticated`. A provider response must confirm authenticated delivery and asset identifiers before an owner-bound `PrivateKycDocument` is created. Clients receive `kyc://<record-id>`, not a delivery URL. KYC submission accepts only references belonging to the submitting account. Direct signing cannot target the KYC folder.

`GET /uploads/kyc/:id/access` requires an active account and ownership or the current admin role. It issues a 60-second signed download URL with a no-store response and records an access audit without the URL/signature. The URL is a temporary bearer capability: anyone receiving it can use it until expiry. Avoid copying it into support tickets or analytics.

Web, native and admin support private references. Admin marks old HTTPS links as legacy. This warning does not make the old asset private. Account-deletion requests inventory private references for restricted retention/processor review; they do not automatically destroy legally retained identity evidence.

## Legacy migration procedure — production gate

1. An authorized privacy operator inventories every KYC document reference, plus abandoned assets in the old KYC folder. Keep this inventory in restricted storage. Record asset identifiers, owning account, verification record, delivery type and applicable retention/hold. Do not put document URLs or identity contents in Git.
2. Verify Cloudinary account ownership and actual asset metadata using the provider API. Never fetch arbitrary database URLs on the API server. Identify non-Cloudinary assets and broken references for separate review.
3. Migrate each permitted retained asset to authenticated delivery using Cloudinary's supported asset operation, preserving the verification linkage and an idempotent migration checkpoint. Create the owner-bound private registry entry and replace the KYC reference only after the provider confirms private delivery. Resolve shared references explicitly; do not assign another user's document to a new owner.
4. Invalidate the original public URL and all derived/cached versions through the provider. If the old asset was copied rather than converted, remove the public original after reference verification. CDN invalidation is asynchronous; record provider evidence and recheck after propagation. Do not assume changing a database URL revokes public access.
5. From an unauthenticated client verify the original, transformed and current private delivery URLs deny access. Verify owner/current admin previews succeed, unrelated users cannot obtain viewing links, and expired download links fail. Test image and PDF assets against the actual production account's delivery restrictions.
6. Review orphan uploads and deleted-account documents against an approved purpose/retention schedule. Delete expired assets at the processor and retain minimal deletion evidence. Resolve migration failures before release; never silently discard legally held documents.
7. The privacy lead assesses whether prior public delivery represents a personal-data incident, documents the assessment and handles applicable notifications. Engineering must not declare there was or was not a reportable breach without that assessment.

No production migration or processor deletion has been executed by this implementation. A repeatable migration utility needs the real asset inventory and confirmed provider operation/retention rules before it can safely mutate existing identity evidence.

References: [Cloudinary access controls](https://cloudinary.com/documentation/control_access_to_media), [Upload API](https://cloudinary.com/documentation/image_upload_api_reference), [Ghana Data Protection Commission guidance](https://dataprotection.org.gh/wp-content/uploads/2025/07/GUIDELINES-TO-DEMONSTRATE-DATA-PROTECTION-COMPLIANCE-1.pdf).


## Admin decision persistence correction — 13 September 2026

The KYC queue previously updated local status before saving and swallowed API failures; Request More fabricated an in-review status without a server endpoint. Approve/reject now update the local queue only after a successful response. While saving, decision controls are disabled. Failed decisions preserve pending state, keep the detail dialog open, display the error in the queue/dialog and permit retry. Request More now reports that it is unavailable and no change was saved rather than claiming a recorded request.

Two admin component tests pass for denied approval followed by confirmed retry, and unsupported Request More without any API call or status change. Admin type-check and affected lint pass. The initial Request More test used the detail-dialog label while exercising the shorter queue button; only that selector was corrected. Logs: `/tmp/ujimora-kyc-save-{tests,types,lint}.log`.

This corrects misleading persistence feedback; it does not implement a complete KYC information-request workflow. A durable request with reason, delivery/visibility, applicant response and audited transitions remains an engineering gap, alongside reviewer diligence and external identity-provider evidence.


The phone-browser KYC flow now verifies a server failure leaves the dialog pending and retryable, a confirmed retry closes it, and reopening the record does not restore pending decision buttons. Inspection found selected records were taken from the original fetched array after a local confirmed decision; selection now uses the confirmed display status, and counters also incorporate confirmed local decisions. The final browser test and two component tests pass; admin type-check and affected lint pass. Type-check caught Playwright-only `exact` options in new Testing Library assertions; these were removed. The screenshot fixture now includes its update timestamp and captures after animations, avoiding an intermediate fade frame. Final error-state screenshot inspected: `/tmp/ujimora-kyc-save-failure-phone.png`. Logs: `/tmp/ujimora-kyc-save-browser.log`, `/tmp/ujimora-kyc-save-final-{tests,types,lint}.log`.

The complete admin suite was rerun after the KYC status/dialog changes: all 64 tests across 17 files pass with one worker, and the admin production build passes (bundle-size warning remains). Logs: `/tmp/ujimora-kyc-admin-full-tests.log`, `/tmp/ujimora-kyc-admin-build.log`.
