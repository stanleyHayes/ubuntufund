# Ujimora Monorepo — Production Completion Ledger

### 2026-09-13 — Disabled-push permission verified in artifacts/device

- On09c32ad, assembleRelease/bundleRelease83886 pass in37seconds with lint enabled. Actual APK and AAB manifests omit POST_NOTIFICATIONS and retain screen-sharing permission. APK ZIP alignment passes; all48 native binaries match the prior inspected APK, retaining27RELRO findings.
- APK installs on dedicated emulator-5580; installed requested-permission inventory excludes POST_NOTIFICATIONS, cold startup succeeds507ms. Debug signing/non-routable API constraints remain. Evidence `/tmp/ujimora-no-push-*`; PUSH_NOTIFICATIONS.md records hashes and scope. No verification job remains running.


### 2026-09-13 — Remove permission for disabled push

- Android blockedPermissions now removes POST_NOTIFICATIONS because push is unavailable and registration/presentation are suppressed. Restore only with implemented consent/delivery rollout. Expo prebuild and release manifest task pass; parsed merged manifest confirms notification permission absent and screen-sharing permission retained.
- Logs `/tmp/ujimora-push-permission-prebuild.log`, `/tmp/ujimora-push-permission-manifest.log`. Previous APK/AAB precede this config delta; final package/device verification remains open. No JS/API change or production permission revocation claimed.


### 2026-09-13 — Full API regression and device-specific split install complete

- API45526 is terminal exit0:1,218tests across165files pass in1,090.26seconds, source1a43ae5. Current API/shared diff against that baseline is empty. This supersedes running entries below and covers wallet attribution, creator currency consistency, null account closure/privacy and historical closure audit. Source freeze lifted; no verification jobs remain running from this checkpoint.
- Google bundletool generates4 device-specific APKs from the current AAB; all4 pass ZIP16KB checks and install on dedicated emulator-5580. Installed package paths confirm base/ARM64/en/mdpi splits. Cold startup472ms, ReactNativeJS main runs, PID7688 remains alive; settled screenshot inspected with expected non-routable-API error. Native ledger records limitations.27RELRO findings remain.
- Logs `/tmp/ujimora-api-1a43ae5-full.log`, `/tmp/ujimora-current-split-{build,install,startup,logcat,paths}.log`, `/tmp/ujimora-current-split-alignment.json`; screenshot `/tmp/ujimora-current-split-settled.png`. Provider, physical-device, final signing and legal/store gates remain open.


### 2026-09-13 — Android App Bundle packaging verification

- Current-source bundleRelease68262 passes in38s; Google bundletool1.18.1 validates the resulting AAB (exit0) and config declares PAGE_ALIGNMENT_16K. All48 bundled native binaries match the inspected APK byte-for-byte, so27RELRO findings remain rather than being hidden by different packaging.
- AAB SHA2561b80160f0b7f43f3e82f3fad66a635adbc3f54c1e7393ddf30f52c1dad6d3cb6. Debug signing/non-routable API remain local-test limitations; no store upload. Native ledger has evidence. API45526 still running.


### 2026-09-13 — Native finding classification and loaded-library evidence

- All48 current APK libraries pass LOAD alignment;27fail RELRO-end alignment specifically. Rechecked current Android documentation and retained that check. Seven flagged ARM64 libraries are among13 actually loaded at successful startup, established by matching executable APK map offsets to ZIP library entries.
- Native ledger distinguishes static findings from proven runtime failures. Artifact `/tmp/ujimora-current-apk-loaded-libraries.json`; feature/device/store checks remain open. No runtime compatibility claim inferred from startup alone.


### 2026-09-13 — Current APK16KB startup evidence

- Current APK installs successfully on dedicated emulator-5580 (PAGE_SIZE16384; linker compatibility=false, package compatibility disabled=true) and cold-starts in665ms. ReactNativeJS main runs, PID7452 remains alive, screenshot inspected: expected unavailable-API screen and app tab bar. API URL deliberately non-routable; no real payment/provider/account operation exercised.
- Logs `/tmp/ujimora-current-apk-{install,startup,startup-logcat,maps}.log`, screenshot `/tmp/ujimora-current-apk-startup.png`. Startup does not close27static ELF findings or prove feature-loaded libraries/physical-device/store acceptance. API45526 still running.


### 2026-09-13 — Current Android APK built;27 ELF failures remain

- Current-source/root Android89595 completes exit0 in5m35s,973tasks (937executed), lint enabled. APK SHA256 f058b3eac4e037d56963b538cfffa494790769de4edc9a63be9adce7801a7296. Debug-signed, non-routable API, normal committed dependencies/default NDK27.1.
- Actual APK ZIP16KB alignment passes. ELF inspection passes21/48, fails27/48. Earlier16-failure count belongs only to the experimental custom-runtime APK and must not be presented as the committed product's count.
- Actual packaged manifest confirms targetSDK36, backup disabled and no background-location/overlay/broad-media-read permissions. Native ledger records scope. API45526 remains running; Android source freeze lifted after terminal build, API/shared freeze remains.


### 2026-09-13 — Current-source Android artifact verification running

- Started root generated Android assembleRelease, session89595, log `/tmp/ujimora-current-android-build.log`, source1e4b61c. Uses committed native plugins/default NDK27.1, ARM64/x86_64, lint enabled, debug signing and non-routable API; no experimental React Native/runtime substitutions. Build configuration reports minSDK24/compileSDK36/targetSDK36. Actual packaged manifest/ELF verification awaits terminal artifact.
- Full API session45526 continues against unchanged1a43ae5 API/shared. Preserve API/shared/native sources while these builds run; poll existing handles, do not duplicate. Neither running job is recorded as successful.


### 2026-09-13 — Browser privacy and donation-consent verification

- Browser legal/deletion links, narrow legal layout, explicit account agreement and private data-request/download checks pass (7 cases). Three donation name/message consent cases initially failed because mocked campaigns omitted endDate after checkout began enforcing deadlines. Fixtures now supply a future endDate; all3 rerun consent cases pass. No application guard was weakened.
- Logs `/tmp/ujimora-browser-compliance-1fa85fb.log` (7pass/3fixture failures) and `/tmp/ujimora-browser-consent-final.log` (3pass). API full session45526 remains running on unchanged source.


### 2026-09-13 — Current production builds and workspace checks

- Web/admin/marketing production builds pass; existing large-chunk warnings remain. All14 uncached workspace type/lint tasks pass with no lint errors (existing hook/unused-import warnings remain). Logs `/tmp/ujimora-{web,admin,marketing}-ceb9304-build.log` and `/tmp/ujimora-ceb9304-workspace-checks.log`.
- API full session45526 remains running on unchanged1a43ae5 source. This checkpoint adds build/static-analysis evidence and does not imply API/provider/store acceptance.


### 2026-09-13 — Complete current frontend test checkpoint

- All current UI suites pass: web203/48files, admin73/21files, marketing10/4files, native109/23files (native checked at the same implementation in preceding checkpoint). Logs `/tmp/ujimora-{web,admin,marketing}-85314b7-tests.log` and `/tmp/ujimora-mobile-1a43ae5-tests.log`. These are test-suite results, not live-provider or signed-device acceptance.
- API full session45526 remains RUNNING on unchanged1a43ae5 API/shared sources. Preserve that source baseline; latest authoritative output is `/tmp/ujimora-api-1a43ae5-full.log`. No full API success claimed yet.


### 2026-09-13 — Current native tests/export and replacement API regression

- At1a43ae5, all109 native tests across23 files pass, and iOS/Android/web JavaScript export completes exit0. Logs `/tmp/ujimora-mobile-1a43ae5-tests.log` and `/tmp/ujimora-mobile-1a43ae5-export.log`; artifacts `/tmp/ujimora-mobile-1a43ae5-export`. These are not signed-device or native-library alignment acceptance.
- Replacement full API session45526 is RUNNING against1a43ae5 API/shared sources, log `/tmp/ujimora-api-1a43ae5-full.log`. Keep those sources stable until terminal; poll this handle and do not duplicate the run. The earlier25869 run was deliberately interrupted and is not a pass.


### 2026-09-13 — Wallet public-name and anonymity choice

- Wallet form previously sent isAnonymous=false without a name, and legacy wallet use case discarded donorName. It now presents an editable account-name default, explicit anonymity checkbox and review explanation; chosen names are bounded and forwarded with terms consent. Anonymous requests omit the name. Existing records are not retroactively attributed; public moderation remains in force.
- Named/anonymous browser payload flow passes;10 focused API tests, web/API types and affected lint pass. Logs `/tmp/ujimora-wallet-name-{browser,api,web-types,api-types,lint}.log`.
- Previous full API session25869 was intentionally interrupted (SIGINT, exit130) to apply this user-facing API/shared correction. It did not complete and is not a passing baseline. No full regression remains running; rerun against the new implementation is still required.


### 2026-09-13 — Current dependency checkpoint and API release regression

- Fresh production dependency audit still reports9 entries across the two locally mitigated parser chains; all6 consumer security tests pass. DEPENDENCY_SECURITY.md records exact evidence and upstream limitations.
- Full API regression started on d6b3a05 API/shared sources, session25869, log `/tmp/ujimora-api-d6b3a05-full.log`. Keep API/shared source unchanged until terminal; poll the existing handle rather than duplicating the run. This is RUNNING, not a pass. Previous1210-test baseline predates recent currency/closure/privacy changes.


### 2026-09-13 — Historical closure inventory

- Added read-only paginated snapshot audit for account deletion requests versus persisted closure/core-cleanup markers. No repair mode, model initialization or contact/provider data in reports. Operator instructions and exclusions are in ACCOUNT_CLOSURE_AUDIT.md.
- Two real-database tests verify findings, exact record preservation, pagination, output privacy and invalid options; API types/lint pass. Production inventory and approved historical repair remain open.


### 2026-09-13 — Consistent open-account checks for privacy rights

- Real-database follow-up found an explicit null deletedAt was rejected during authentication (HTTP401), before privacy submission could run. User repository lookups/save/closure and data-rights submission/response now consistently treat missing/null as open and a timestamp as closed.
- Null-state access-request/response regression passes;15 privacy/erasure tests and7 authentication/deleted-account tests pass. API types and affected lint pass. No production account state changed; historical cleanup reconciliation remains open. See DATA_RIGHTS.md.


### 2026-09-13 — Null-safe account closure

- Deletion request and retry worker now persist tombstones for both missing and explicitly null deletedAt fields. The old missing-only filter could clean an account without persisting closure. Comment cleanup now handles the same null case while preserving existing deletion timestamps.
- Two real-database regressions fail before the fix and pass afterward. Direct adapter execution bypasses in-process token revocation, proving persisted closure rejects old access tokens; wallet balances remain unchanged. All6 erasure integration tests, API types and affected lint pass. Evidence in DATA_RIGHTS.md. Processor erasure and retention approvals remain open.


### 2026-09-13 — Goal reached campaigns remain open

- User clarified reaching a funding goal must not close donations. API already supports overfunding; web wallet/detail/checkout and native checkout incorrectly restricted donations to ACTIVE. Shared eligibility now accepts ACTIVE and FUNDED before endDate, while keeping drafts, pending, blocked and expired campaigns closed.
- Removed misleading inactive badge for funded/open campaigns; shows “Goal reached · Still accepting donations”. Native detail donation button follows the same eligibility rule. Payout goal milestones remain intact.
- Two browser flows verify active and funded campaigns above goal can open wallet and continue to checkout. Three shared eligibility/amount/provider tests and14 API campaign tests pass. Web/mobile types and affected lint pass. The contract test now uses Vitest to load the shared TypeScript package consistently (Node ESM re-export failed initially). Logs: `/tmp/ujimora-overfund-browser.log`, `/tmp/ujimora-overfund-policy-web.log`, `/tmp/ujimora-overfund-api.log`, `/tmp/ujimora-overfund-web-types.log`, `/tmp/ujimora-overfund-mobile-types.log`, `/tmp/ujimora-overfund-lint.log`.


### 2026-09-13 — Creator withdrawal currency consistency

- Source audit found bank withdrawals read currency before reserving funds without checking the actual reserved balance. A changed currency could produce a payout in the stale currency. The reservation now checks currency inside the transaction and rolls back on mismatch before creating a payout or sending a transfer.
- Regression reproduced HTTP201 before the fix, then verifies HTTP409, unchanged available balance, no payout and no transfer. All31 creator-withdrawal integration tests pass; API types and affected lint pass. Wallet transfers already reserve with an explicit GHS filter.
- This is prospective consistency protection; historical reconciliation, provider acceptance and remaining financial-write audits stay open. Full API baseline predates this delta.


### 2026-09-13 — DataStore native library upgrade

- Added Expo DataStore plugin pinning the androidx.datastore family to1.2.1. Generated Android prebuild succeeds with exactly one pin; affected lint passes.
- Isolated APK33497 builds with lint enabled. Both packaged DataStore libraries exactly match stripped published1.2.1 binaries and pass LOAD/RELRO; APK ELF results improve to32/48. Emulator update/start succeeds (691ms cold launch). Storage-path, full device and remaining16native-library checks remain open.
- User requested token/scope clarity: ledger still has15technical/audit areas and5external gates open. These are broad areas, not20small tests; no completion or account-token estimate is claimed.


### 2026-09-13 — Wallet terms visible independently of message

- Wallet donation terms/18+ checkbox is now always visible and required, even with the optional message empty. The wording refers to this donation. Submission includes acceptance with or without a message; reopening starts unchecked. This supersedes the prior message-conditional UI behavior.
- Browser regression passes for both blank-message and public-message requests, unchecked/checked/revoked gating and reset. Web types and affected lint pass. No API/content guard changed.
- Background DataStore APK33497 completed exit0 in1m15s; actual ELF pass count improves to32/48 (`/tmp/ujimora-datastore-apk-elf.json`). New WebRTC144.7559.15 AAR passes only1/2ABIs; not promoted. DataStore package/runtime verification and production integration remain pending.


### 2026-09-13 — Candidate APK startup and DataStore candidate

- Installed native candidate cold-starts on16KB emulator with compatibility disabled; React Native renders the expected unavailable-API screen. Evidence includes PID log, activity state and inspected screenshot. Scope remains archived/debug-signed/non-production.
- DataStore1.2.1 native AAR passes both-ABI alignment; newer graphics/Fresco candidates still fail. Isolated APK33497 now evaluates aligned DataStore modules with prior runtime candidates; production configuration unchanged. Native ledger has evidence and remaining gates.


### 2026-09-13 — Wallet message terms acknowledgement fixed

- Wallet donation dialog now displays the shared unchecked content-terms/18+ acknowledgement when a public message is entered. Confirmation stays disabled until accepted; the request includes current-version legalAcceptance. New donations reset consent and blank messages do not trigger unnecessary message acceptance. Backend enforcement remains intact.
- Web types and affected lint pass. Browser regression verifies unchecked/checked/revoked gating, policy link, exact wallet request payload and reset on reopening; final run passes. Initial test harness imports failed and were corrected; no application error was bypassed.


### 2026-09-13 — Checkout payment-method redesign

- Replaced the compact row of generic provider symbols with mobile-money/card panels, clear category icons/titles/descriptions, readable provider name badges and subtle SVG watermarks. Panels stack on narrow screens and use theme tokens; selectable wallet choices retain native button/keyboard and selected-state behavior. Payment rails/checkout logic are unchanged.
- UI types, affected lint and web production build pass. Three existing checkout/wallet browser flows pass; four temporary visual checks pass at320/390/1440 widths across light/dark themes with no horizontal overflow. Desktop-light and phone-dark previews inspected (`/tmp/ujimora-payments-1440-light.png`, `/tmp/ujimora-payments-390-dark.png`).
- Background APK35851 completed exit0 in1m37s with lint enabled. Actual packaged ELF inspection remains a partial result; see native ledger for release scope and next checks.


### 2026-09-13 — Native build complete; APK lint memory retry

- Native70084 completed exit0 in11m9s. Experimental app JNI source now supplies verified C++/fbjni candidates; all four merged native files match their hashes. Final APK provenance/device checks remain required.
- APK24833 failed terminally due to lint Metaspace exhaustion. Retry35851 is live with increased JVM limits and two workers, retaining lint. Archived source/debug signing/non-routable API scope only; production dependency selection is unchanged. Evidence in `docs/compliance/NATIVE_PERMISSIONS.md`.


### 2026-09-13 — Both-ABI candidate alignment and runtime device evidence

- C++ x86_64 build27955 completed successfully; it and three x86_64 React Native source libraries pass LOAD/RELRO. Both-ABI candidate runtime alignment is verified, with only the previously recorded profiling-marker export difference.
- Added/re-ran reusable ARM64 runtime probe: actual16KB emulator, candidate mapping,32 dynamic-library cycles and256 cross-library allocation/exception/TLS cleanup checks pass. This does not establish full ABI, x86_64 execution or packaged app acceptance.
- Native70084 remains live; final source/runtime packaging and device/provider/store gates remain open. Evidence in `docs/compliance/NATIVE_PERMISSIONS.md`.


### 2026-09-13 — ARM64 native/runtime candidates pass ELF checks

- Reconciled all51 pinned Android patch references and applied10 runtime-relevant patches. Isolated ARM64 libc++ build passes; it and three source-built React Native libraries pass LOAD/RELRO. Only exported-symbol difference from NDK libc++ is the compiler profiling marker; runtime/ABI/device acceptance remains open.
- C++ x86_64 candidate27955 and React Native70084 remain live. Candidate binaries are not installed into the app. Details and reproducible paths in `docs/compliance/NATIVE_PERMISSIONS.md`; no API/shared changes.


### 2026-09-13 — Hermes candidate alignment verified

- Corrected source-built Hermes passes LOAD/RELRO on both64-bit ABIs and preserves all71 defined dynamic exports per ABI. ReactAndroid build70084 remains live; final packaging/device and prebuilt runtime gates stay open.
- Retrieved pinned NDK C++ runtime base sources and build recipe. Patch inventory has two404s/eight503s; source remains unapplied/unbuilt until provenance is reconciled. Exact evidence/paths in `docs/compliance/NATIVE_PERMISSIONS.md`.


### 2026-09-13 — Corrected included native build candidate

- Completed Hermes outputs from initial candidate fail RELRO on both64-bit ABIs; app-root flags did not reach the included React Native build. Recorded exact ELF and configuration evidence in `docs/compliance/NATIVE_PERMISSIONS.md`.
- Intentionally cancelled90233 after confirming the defect (terminal130), then started70084 with an explicit init script. Both Hermes ABI caches now contain both required page-size flags; compilation is live. No app dependency/runtime selection changed and no candidate ELF/device pass claimed.


### 2026-09-13 — Current settlement API regression completed

- Full API41412 completed exit0 on unchanged de8b9e2 API/shared: 1,210 tests across163 files pass, 1,252.56seconds. Includes split-consent locking, atomic wallet settlement, required campaign projections and read-only historical audit. Log `/tmp/ujimora-current-accounting-full-regression.log`. Root API/shared freeze is lifted; no duplicate full run needed for later native/docs-only changes.
- Native source build90233 remains live. Generated Hermes CMake caches on both64-bit ABIs show empty CMAKE_SHARED_LINKER_FLAGS: the app-root callback does not reach the separate included React Native build. Prepared `/tmp/ujimora-native-source-alignment.init.gradle` for a subsequent isolated invocation; it has not changed the live build or repository dependency selection.


### 2026-09-13 — Strict native inspection and NDK29 evidence

- NDK29 installed successfully but both bundled64-bit C++ runtimes fail the documented RELRO-end check. Toolchain version alone is not acceptance evidence; no runtime selection changed.
- Closed a checker false-pass case: missing RELRO now fails. Five CLI regression cases pass, and six previously aligned dependency binaries remain passing under the stricter gate. Evidence in `docs/compliance/NATIVE_PERMISSIONS.md`.
- React Native source build90233 remains live in an isolated archived checkout; full API41412 remains live on unchanged de8b9e2. No duplicate run or root API/shared mutation.


### 2026-09-13 — Prebuilt runtime candidate evaluation

- NDK28.2 installed and inspected without selecting it: ARM64 libc++_shared still fails RELRO-end alignment; x86_64 passes. ReactAndroid and fbjni AARs both bundle the runtime, so a toolchain upgrade alone cannot prove packaged provenance.
- Pinned fbjni0.7.0 source builds pass on ARM64/x86_64 with both alignment flags; both candidates pass ELF checks and retain all300 original JNI exports. Candidates are not integrated; ABI/runtime, duplicate-library packaging and other prebuilts remain open. Details in `docs/compliance/NATIVE_PERMISSIONS.md`.
- NDK29 installation88258 is running side by side for comparison; log `/tmp/ujimora-ndk29-install.log`. Full API41412 remains running on unchanged de8b9e2 source. Preserve both running operations and root API/shared freeze.


### 2026-09-13 — Dependency native RELRO correction

- Extended the Expo alignment plugin to register both linker flags before Android library projects configure CMake. Prebuild confirms placement/idempotent marker; lint passes. Archived NDK27.1/JDK17 dependency build succeeds in41s, and all six Expo Modules Core/Expo Updates/Screens libraries on ARM64/x86_64 now pass LOAD+RELRO checks.
- Together with the prior eight app/codegen outputs, 14 source-built libraries are verified. Prebuilt binaries and final current-source signed packaging/device paths remain open; evidence in `docs/compliance/NATIVE_PERMISSIONS.md`.
- Full API41412 continues on unchanged de8b9e2 API/shared; retain root source freeze until terminal.


### 2026-09-13 — App native RELRO alignment correction

- Expo plugin adds both Android-documented page-size linker flags to the app CMake invocation. Prebuild confirms generated option once; lint passes. Archived native ARM64 and x86_64 builds with the same option pass under NDK27.1/JDK17; all eight appmodules/codegen libraries now pass LOAD+RELRO alignment checks.
- Copied prebuilt and separately compiled dependency findings remain open; combined inspection still exits1. No final signed APK/AAB or renewed runtime acceptance claimed. Scope/build evidence: `docs/compliance/NATIVE_PERMISSIONS.md`.
- Prior full API97713 finished successfully (1,202 tests/162 files at428402b). Root fast-forwarded tode8b9e2. New full API41412 is running on unchanged de8b9e2 API/shared, log `/tmp/ujimora-current-accounting-full-regression.log`; this includes the later campaign-accounting and historical-audit changes. Keep root API/shared frozen until terminal.


### 2026-09-13 — Full wallet settlement regression completed

- Full API97713 finished exit 0: 1,202 tests/162 files pass, 943.05 seconds. API/shared source stayed at428402b; root source freeze is lifted. Later campaign-accounting and historical-audit deltas retain separate focused evidence and still need final full-run inclusion. Log `/tmp/ujimora-wallet-atomic-full-regression.log`.


### 2026-09-13 — Preserve ambiguous native payment recovery

- Legacy-to-hashed payment request migration now rejects conflicting saved attempt IDs and blank stored IDs, preserving records and stopping checkout before API access. Matching identities still remove redundant plaintext safely; no automatic historical purge or payment replay.
- All 17 payment recovery tests, native types, affected lint and whitespace checks pass. Evidence and remaining historical/device privacy gates: `docs/compliance/STORE_DATA_INVENTORY.md`. Native installation/build verification remains open.
- Root full API regression97713 remains running on unchanged 428402b API/shared. Work was isolated; do not fast-forward root API/shared until terminal.


### 2026-09-13 — Read-only historical donation integrity inventory

- Added a paginated snapshot audit for aged successful intents: journal/donation/outbox linkage, journal balance/settlement totals and wallet-history owner/currency/amount/status. No provider calls, money movement, receipt replay, automatic repairs or model/index initialization; reports omit donor/contact/provider details.
- Four real-database tests pass, including unchanged database snapshots and deterministic paging; API types/affected lint and local CLI smoke pass. Usage, interpretation and explicit unverified historical projection/provider/compensation scope: `docs/compliance/HISTORICAL_DONATION_AUDIT.md`.
- Production read-only attempt66504 exited 1 with no report; DNS resolves, but database access/snapshot acceptance remains unverified. Connection diagnostic92829 finished with Error/ETIMEOUT; production connectivity remains an external verification gate. No production record was changed. Root full API97713 remains running on unchanged 428402b source; this isolated audit tool and campaign projection change are not covered by that baseline.


### 2026-09-13 — Required campaign accounting and wallet eligibility

- A missing/deleted/currency-mismatched campaign projection now aborts the settlement transaction instead of leaving partial accounting marked successful. Wallet settlement checks current campaign status/end date/currency and serializes against concurrent moderation; late externally verified payments remain accountable after expiry.
- All 27 focused integration tests, API types, affected lint and whitespace checks pass. No production funds modified. Evidence, late-payment semantics and remaining historical/eligibility/provenance gaps: `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`.
- Implemented in isolated checkout while root full regression97713 remains on unchanged 428402b API/shared. Do not fast-forward root until that run is terminal; this delta has separate focused evidence.


### 2026-09-13 — Atomic wallet donation accounting

- Published as `428402b`; root main synced to origin. Full API regression97713 is now running on unchanged 428402b API/shared source, log `/tmp/ujimora-wallet-atomic-full-regression.log`. Keep root API/shared frozen until its terminal result; continue read-only audit or new implementation in the isolated checkout.

- Wallet debit, required donor transaction history, intent success and campaign settlement now commit together. Removed post-error compensation that could refund an uncertain committed donation. Known insufficient-funds refusals commit FAILED and free a coupon seat; unexpected write failures leave a resumable intent without money movement.
- Interrupted wallet requests resume from the stored owner/amount/tip; idempotency lookup and creation-race winners reject mismatched account/payment method. Six real-database wallet cases cover after-write rollback/retry, concurrent debit, delivery failure, insufficient funds and mismatched charge; the route resume test checks ownership and original amount.
- All 44 tests in six focused files passed, then all 18 tests in the two affected retry files passed after final binding hardening. API types, affected lint and whitespace checks pass. No production funds/history modified. Details and remaining historic reconciliation/provenance/external gates: `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`.
- Full de49df2 baseline FINISHED: 1,187 tests/162 files pass, 974.81 seconds. Process97096 is terminal and root API source freeze is lifted. The full run excludes later split-consent and wallet changes; their focused checks are recorded separately.


### 2026-09-13 — Locked split consent at donation accrual

- Accrual uses the exact version returned by the lock, requires all beneficiaries' stored consent, and preserves the first lock timestamp on subsequent contributions. A write counter serializes concurrent consent/amendment changes; the encompassing donation transaction rolls back failed allocation.
- All 28 focused tests across four files pass, including independent consent and amendment writes during settlement; API types, affected lint and whitespace checks pass. Evidence and remaining wallet debit/crash, historic repair, provenance and external gates: `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`.
- Implemented in isolated `/tmp/ujimora-split-consent` while root full API regression remains on de49df2. Do not fast-forward root API/shared until its OS process97096 and log confirm a terminal result. The running baseline does not cover this later delta.


### 2026-09-13 — Descriptive admin dropdowns

- Standardized admin select fields and coupon multi-selects through shared AdminTextField/AdminSelect: meaningful icons, human-readable titles, contextual descriptions, selected checkmarks, themed surfaces and accessible description associations. Closed fields show compact titles; raw values, existing selection callbacks, disabled choices and coupon checkbox behavior remain intact. KYC filter columns widened; selected titles wrap instead of truncating. Sign-out menu also has explanatory copy.
- Covers status, roles, tiers, campaign categories, KYC types, content queues, contact types, donation anonymity, coupons/commission/billing/surfaces, language, review rules, crypto age and page-size menus. Existing export and profile menus retain their rich content and SVG watermarks; sidebar connectors are unchanged. Added the convention to apps/admin/AGENTS.md.
- All 71 existing admin tests plus two new raw-value/disabled/multi-select tests pass. Fourteen mocked browser flows cover the seven supplied sections at 390/1440 widths in dark/light themes, including option icons/descriptions, selection, keyboard open/Escape/focus and overflow. Rechecked the Plus plan label after mapping legacy starter to its correct description. Screenshots inspected; admin types/build pass and lint has only the existing PublicationReviewsPage ref warning. No production status or financial record was changed by verification.
- API/shared source remains unchanged at de49df2 during full regression. Original tool handle73343 was lost after interruption, but OS process97096 was verified live and its log continued advancing; do not restart or lift the API source freeze from handle loss alone.

### 2026-09-13 — Atomic donation settlement

- Published as `de49df2`. Full API regression73343 is running against unchanged de49df2 API/shared source; log `/tmp/ujimora-donation-atomic-full-regression.log`. Do not edit or fast-forward root API/shared source until this process is terminal. Continue read-only audit or use an isolated checkout for new implementation. This run supersedes neither the old failed baseline result nor external provider/store verification until its terminal evidence is recorded.

- Donation success, record, journal, campaign/split projections and outbox now commit in one required transaction; delivery follows commit and cannot trigger compensation of committed funds. Ledger account writes are sequential within the transaction. Five real-database rollback/concurrency/delivery tests and 38 existing focused tests pass; API types/lint pass. Scope/evidence and remaining wallet-debit, split-consent, historic repair and provider/full-suite requirements: `docs/compliance/DONATION_SETTLEMENT_INTEGRITY.md`.

### 2026-09-13 — Regression recovery and settlement audit

- Replaced the stale TransferUncertainty payout stub with the real entity; now verifies the provider receives the persisted reference and funds are reserved once without refund on an ambiguous outcome. All five focused timeout/testimonial tests and API types pass. Testimonials passes in isolation unchanged; the earlier full-run HTTP400 remains an unresolved intermittent failure, not a proven fix.
- Source audit found donation settlement commits its success gate before donation/journal/balance/split/outbox writes, without an encompassing transaction. Split lock/read also consumes a separately fetched version. Next establish atomic settlement before adding a consent failure gate, so failed allocation cannot leave partial credited funds. Wallet debit compensation/crash recovery and historic partial-settlement reconciliation remain separate audit requirements.

### 2026-09-13 — Admin wallets and focused member/profile layouts

- Added Community → Wallets and member wallet balances/transaction history, with staff-only no-store paginated reads, explicit safe fields, grouped branded exports, skeleton/error/retry/illustrated empty states and preserved sidebar connectors. Wallet balances stay separate from campaign proceeds and currencies are not summed together.
- Member donations now use a server-side donor filter, including the member's anonymous contributions without changing public anonymity. Failed requests expose the server message and Retry instead of a dead-end generic alert. Campaigns and donations stack full width. Trust guidance distinguishes verification/evidence from the currently non-automatic numeric score.
- Light-theme browser inspection also exposed dark sidebar text on the permanent forest surface and inherited header text colors; corrected explicit surface-appropriate foregrounds while preserving connectors.
- Admin profile now has Personal details/Security/Preferences tabs, retained unsaved input, section watermarks, accessible password toggles and a working language menu/save action. Removed fabricated creation/last-login dates.
- Verification: three API integration tests (including current-admin checks, member isolation, pagination, private-field exclusion and anonymous donor filtering), four profile tests, mocked phone/desktop browser flows including donation retry, wallet loading/empty/error/export and retained profile drafts; API/admin types, affected lint and admin production build pass. Existing bundle-size advisory remains. Original production donation failure was not independently reproduced; the scoped load and retry path are covered locally. Live financial/provider data was not modified.
- Earlier full API regression70997 is TERMINAL, exit 1 at f09cba3 API baseline: 1,161 passed, one failed and two skipped; 158 passed/2 failed files. Failures are testimonials login fixture (HTTP400) and TransferUncertainty fake payout missing toPlain. Root source freeze is lifted. These baseline failures and broader compliance/release gates remain open; this full run does not cover later settlement/split/wallet changes.

### 2026-09-13 — Blog studio and reported admin UI fixes

- Implemented Content → Blog with Details/Write/Media/Review steps, rich-text toolbar, Markdown source/shared safe preview, authenticated media uploads, explicit review-before-publish, revision-safe private drafts and unpublishing. Preserves the six existing public articles on first migration. Published-only sitemap and grouped branded PDF/Excel/CSV exports included; sidebar connectors retained.
- Fixed Contact Submissions dialog theme/close/contrast and visible failed-save handling with retained notes. Fixed About team-photo root-relative URLs; shared uploader now provides loading and retry states while retaining Replace/Remove.
- Main implementation pushed as `88fbcdf`; all three Vercel deployments reported successful. Follow-up URL validation rejects malformed/non-HTTPS cover URLs with HTTP 400; focused API tests/types/lint pass. Follow-up pushed as `8889bc2`; Render deploy `dep-daj8rplckfvc739jfcsg` reached live at 2026-09-13 11:52:40 UTC. Health returned HTTP 200/status ok and the production marketing blog API returned six migrated articles. All three Vercel checks passed for the same commit.
- Three API integration tests, six mocked phone/desktop browser flows and all ten marketing tests pass. API/admin/marketing production builds and affected type checks pass; lint has only existing unrelated warnings. Detailed scope and verification in `docs/BLOG_STUDIO.md`. Broader compliance goal remains active with its existing external and engineering gates.

### 2026-09-13 — Split activation integrity

- Split activation now serializes campaign amendments and atomically supersedes/promotes only a fully accepted version. Consent changes and write failures preserve the previous active split; concurrent amendments leave exactly one active version. Ten focused integration tests, API types/lint and whitespace checks pass. Accrual version consumption and wider compliance gates remain open. Root regression70997 retains its earlier source baseline.

### 2026-09-12 — Ghana and mobile store compliance goal (IN PROGRESS)

- Beneficiary terminal callbacks, rejected-transfer rollback and reconciliation now commit status, both balances, ledger and settlement flag together. Repair locks the current terminal payout; missing balances and reversal shortfalls fail closed with idempotent retries preserved. All 39 focused integration tests/types/lint pass. Implemented in `/tmp/ujimora-beneficiary-settlement`; publish from that checkout while root regression70997 keeps unchanged f09cba3 API/shared source. Do not fast-forward root API/shared until that run is terminal. Later settlement delta is not covered by the running baseline. Currency/reservation provenance, eligibility/consent and remaining release gates stay open in KYC_REVIEW_INTEGRITY.md.

- Beneficiary first reviews now persist reviewer/time and an exact payout/destination/KYC fingerprint, with current staff authorization inside the transaction. Changed/legacy evidence requires a fresh maker and distinct checker; request/review compare-and-set prevents stale reservations. All 24 focused integration tests, API types/lint and whitespace checks pass, including concurrent first reviews and post-write rollback. Details: `docs/compliance/KYC_REVIEW_INTEGRITY.md`. Published as `f09cba3`. Full API regression session 70997 is running on that unchanged API/shared source; log `/tmp/ujimora-beneficiary-review-full-regression.log`. Keep API/shared source frozen until its terminal result; continue read-only compliance review meanwhile. Eligibility/consent, terminal settlement and wider release gates remain open.

- Beneficiary destination replacement now explicitly removes obsolete KYC reviewer/time fields; reproduced prior stale fields, then verified raw removal and fresh review. All 14 focused tests/types/lint pass. Full API88675 FINISHED exit 0: 1,117 tests/155 files at c8adacf; root freeze lifted and fast-forwarded to78118b9. Later deltas have focused evidence, not coverage from that older full run.

- Beneficiary final reservation now revalidates current staff credentials and locks unchanged KYC/destination evidence; mismatched currency and missing review evidence fail closed. All 13 beneficiary tests/types/lint pass, including five stale-authorization/destination cases with no funds movement or transfer. First-review/evidence/eligibility/settlement scope remains open in KYC_REVIEW_INTEGRITY.md. Root regression88675 continues on c8adacf.

- Beneficiary approval now commits share/campaign reservations and PROCESSING/reference atomically, before provider transfer. Eight integration tests/types/lint pass, including mirror shortfall and failure after processing write with full rollback, plus committed-state provider observation. Final beneficiary staff/KYC/destination and terminal settlement checks remain open; KYC_REVIEW_INTEGRITY.md records evidence. Root regression88675 retains c8adacf.

- Affiliate final approval now transactionally revalidates current staff credentials, active affiliate, original requester account and exact provider destination before committing PROCESSING/reference. Eight real MongoDB/use-case tests and API types/lint pass. Affiliate review/KYC/limits, beneficiary and settlement coverage remain open; details KYC_REVIEW_INTEGRITY.md. Root regression88675 keeps c8adacf source.

- Automatic payout history now requires current account details to match the latest payout-specific manual review snapshots, including maker evidence where present. All 44 focused tests/types/lint pass; missing, changed and superseded evidence fails closed. Legacy records need fresh manual review rather than fabricated snapshots. See KYC_REVIEW_INTEGRITY.md. Root regression88675 remains live on c8adacf.

- Manual bank payout reviews now capture destination snapshots atomically; final single/batched reservations validate current destination and both maker/checker snapshots. All 36 payout/destination tests, types/lint pass, including concurrent address/review mutations. Missing legacy maker snapshots require fresh requests/reviews. Details and remaining scope in KYC_REVIEW_INTEGRITY.md; full root regression88675 retains c8adacf baseline.

- Automatic final reservation now locks and revalidates qualifying settled manual destination history. All 39 focused tests/types/lint pass; six concurrent history corrections/deletion cause retry and 409 without reserving/sending funds. Root full API regression88675 remains on c8adacf; keep source frozen until terminal. Evidence and remaining scope: KYC_REVIEW_INTEGRITY.md.

- Automatic payout final reservation now requires a current dated claim and serializes both daily budgets under current policy without charging twice. All 36 focused tests (32 integration, four verification/uncertainty), API types/lint pass on current main. Five concurrent claim/budget changes fail closed before transfer; real claim-to-provider success verifies committed funds and single budget charge. See KYC_REVIEW_INTEGRITY.md; history/manual-destination and broader release gates remain open.

- Marketing header appearance icon now uses the same light gold as search on its permanent forest surface, with matching 40px sizing and visible hover/focus states. Browser checks passed in light/dark across all four finishes; appearance dialog opens/closes correctly. Marketing types and lint pass; light screenshot inspected.

- Render deployment incident: build succeeded but API startup failed with MongoDB code 86 on Refund.donationId_1 (legacy non-unique index). Added safe startup model/code diagnostics and repeatable in-place prepareUnique/dry-run/unique migration. Production MongoDB 8.0.32 preflight found zero refund records; migration completed without deleting records or indexes. Three real-database migration tests, API types and lint pass. Replacement deploy dep-daj879qjnfac73epeno0 (a080bd0) reached live 11:07:54 UTC; /health HTTP 200/status ok verified 11:08:15 UTC. All 21 refund regression tests also pass. Baseline API regression24306 finished: 1,106 tests across 154 files passed at API0bb30ee; later dispute/diagnostic deltas retain focused verification.

- Android16KB image installed; dedicated emulator5580 booted with PAGE_SIZE16384. APK installed and cold-launched with backcompat properties verified off; ReactNativeJS main/resumed activity, empty crash buffer. Startup-only scope and logs recorded in NATIVE_PERMISSIONS.md; RELRO/full-device/provider/store checks remain open. API24306 remains live; root source unchanged.

- Isolated dispute safeguard: creation/status writes serialize against campaign payout locking; automatic final reservation rechecks unresolved disputes. All 28 focused tests/types/lint pass, including concurrent new/reopened disputes with retry/409/no transfer. Root API regression24306 retains baseline0bb30ee; fast-forward only after terminal result, then current regression required. Details KYC_REVIEW_INTEGRITY.md.

- Actual built APK decoded and checked: SDK36, backup disabled, Firebase defaults disabled, blocked permissions absent and screen-sharing declarations retained. Packaged backup resources resolve to res/Vk.xml and res/m3.xml; all nine exclusions verified for full/cloud/device-transfer. Hashes/provenance in NATIVE_PERMISSIONS.md; physical/runtime/store gates remain open. API24306/image74629 confirmed live.

- Native startup now cleans older app-owned temporary recovery-code exports after interrupted sharing, preserving current exports and unrelated files. All 105 mobile tests, types/lint and Android JS export pass; details in NATIVE_PERMISSIONS.md. Current full API regression 24306 remains live on unchanged API 0bb30ee, `/tmp/ujimora-campaign-recipient-full-regression.log`; keep API/shared source frozen. Android image install 74629 remains live.

- Account agreement page redesigned with existing forest/gold PageBanner and SVG chain watermark, icon/title/description policy cards, responsive confirmation panel and separate opt-in explanation. Removed redundant agreement notice on this route. Both confirmations remain unchecked and required; API contract/saved/error states retained. Desktop1440/phone390 browser flows verify links, overflow, explicit consent and exact save payload; web types/lint/build pass. Screenshots `/tmp/ujimora-agreement-{1440,390}.png`.

- Automatic reservation now locks current policy and destination, checks exact provider code/owner/currency, policy amount limits and review freshness. All 29 focused tests and final API types/lint pass, including five concurrent recipient/policy changes with no funds movement. Separate counter preserves claim totals. Remaining budget/dispute/history/manual scopes recorded in KYC_REVIEW_INTEGRITY.md.

- Automatic bank execution now serializes current campaign owner/status/deletion/cashout eligibility before funds reservation. All 24 focused tests and API types/lint pass, including four concurrent campaign changes with retry/409/no transfer. Recipient/policy/budget and broader release gates remain open in KYC_REVIEW_INTEGRITY.md. Android image install 74629 remains live.

- Manual single/batched bank reservation now serializes current campaign cashout eligibility inside the final staff/money transaction. All 33 focused tests, types/lint pass, including two concurrent eligibility changes with retry/409/no provider transfer. Remaining automatic/recipient/fee/release scope recorded in KYC_REVIEW_INTEGRITY.md. Android image 74629 remains live.

- Campaign wallet settlement now serializes current campaign owner and early-cashout eligibility inside its money transaction. All 46 focused tests, API types/lint pass, including four concurrent campaign mutations with retry/409/no funds movement. Evidence and remaining bank/fee/consumer scope in KYC_REVIEW_INTEGRITY.md. Full 1,091-test baseline predates this delta; Android image install 74629 remains live.

- Full API regression 67839 FINISHED exit 0: all 1,091 tests across 154 files pass (1229.38s), unchanged API/shared source 69d94fa. Includes manual approval reservation, maker review, wallet staff authorization and review/status serialization changes. API source freeze lifted; release/provider/device gates remain open. See API_REGRESSION_TRIAGE.md.

- Android APK retry 37597 FINISHED exit 0 (6m6s). Actual APK ZIP 16 KB alignment passes; all 48 packaged 64-bit libraries pass LOAD alignment, but 41 retain RELRO findings. Hash, logs and local signing/test-endpoint limits recorded in NATIVE_PERMISSIONS.md. Device runtime remains pending; API 67839/image 74629 confirmed live. Public deletion URL returns HTTP 200, but browser inspection was unavailable after two request-header-policy failures; rendered production content is not yet verified.

- APK assemble 37305 ended exit 1 on temporary Metro entrypoint resolution. Corrected only temporary node_modules overlay after terminal result; retry 37597 started with explicit non-routable HTTPS API for startup/native tests. No source/dependency upgrade, successful APK or runtime pass claimed. API 67839 and image install 74629 remain active; NATIVE_PERMISSIONS.md records provenance and limits.

- Native intermediate inventory expands RELRO finding to all 16 observed 64-bit libraries (all pass LOAD alignment). Generated link flags show max-page-size without common-page-size; no single-library fix claimed. Checker evidence in NATIVE_PERMISSIONS.md. APK/API/image-install sessions 37305/67839/74629 confirmed live; preserve their source/dependency state.

- Added repeatable Android 64-bit ELF inventory/check command. Newest inspected WebRTC 150.7871.01 also has nonzero RELRO remainders on both ABIs; no upgrade applied. Dedicated Android 35 ARM 16 KB emulator image installation started for runtime evidence. APK 37305 and API 67839 confirmed live; source unchanged. Details in NATIVE_PERMISSIONS.md.

- WebRTC AAR inspection found 16 KB LOAD alignment but nonzero RELRO end alignment on both installed 64-bit libraries. Candidate 144.7559.15 fixes arm64 alignment only; x86_64 remains nonzero. No dependency upgrade or runtime success claimed; hashes/evidence and next compatibility evaluation in NATIVE_PERMISSIONS.md. APK 37305/API 67839 confirmed live and unchanged.

- Android full assemble 37305 remains live; active ninja/clang compilation confirmed for arm64 appmodules/expo-modules-core. API regression 67839 also confirmed live. Read-only clipboard-provider inspection verifies its restricted .clipboard cache root is separate from recovery-code export files; no unsafe exported-flag change made. Artifact/device/clipboard lifecycle evidence remains open in NATIVE_PERMISSIONS.md.

- Current-source Android prebuild passed from archived 69d94fa; all 184 tracked mobile files match except documented temporary Metro dependency resolution. Full APK assemble session 37305 confirmed live (local debug signing, not store release), `/tmp/ujimora-android-current-assemble.log`. Full API regression 67839 confirmed live on unchanged 69d94fa API/shared source, `/tmp/ujimora-api-manual-approval-regression.log`; preserve source until terminal. No artifact/full-suite pass claimed.

- Payout reviews now conditionally write the pending payout within the authorized review transaction, serializing ordinary/second-review evidence against concurrent status changes. All 46 focused tests, API types/lint pass, including snapshot interleavings with transaction retry and no appended review/funds movement. Remaining snapshot/consumer/release scope recorded in KYC_REVIEW_INTEGRITY.md.

- Campaign wallet settlement now checks current staff role, nonclosed account and credential version inside its money transaction. All 40 focused tests, types/lint pass, including three revocation persistence cases and HTTP rotation after review; corrected new fixture idempotency/balance assumptions without changing production validation. Remaining campaign/destination/fee and release boundaries documented in KYC_REVIEW_INTEGRITY.md.

- Recipient/wallet review evidence now requires current staff authorization; high-value first approval and review commit together, and same-maker retries reject before duplicate review. All 44 focused tests plus API types/lint pass, including maker rollback/revocation and preserved final-bank revocation coverage. Remaining status/snapshot/wallet boundaries are explicit in KYC_REVIEW_INTEGRITY.md.

- Manual single/batched campaign bank approval now commits current staff role/credential authorization, balance reservation and PROCESSING reference/legs together; provider calls follow commit. All 34 focused tests and API types/lint pass, including rollback/retry, three staff revocations and provider committed-state assertions. Remaining maker-review/campaign/destination/wallet/other consumer scope recorded in KYC_REVIEW_INTEGRITY.md. Earlier full API pass predates this delta.

- Disabled Android Firebase messaging auto-init/Analytics collection by default and avoided Expo notification index import, which could refresh persisted legacy push registration. All 103 mobile tests, types/lint and current Android JS export pass. Isolated final manifest asserts both metadata settings false and retained protections (82082 exit 0). Runtime overrides, old IDs/provider registrations, device traffic and SDK removal remain open; see PUSH_NOTIFICATIONS.md.

- Removed unused Android LocationTaskService through an Expo merge plugin and explicitly blocked foreground-location service permission. Actual merged release manifest passes absence/preservation checks (session 99898 exit 0, 1m2s); one-shot KYC foreground permissions, screen sharing, SDK and backup controls remain. Source/signed-device limits recorded in NATIVE_PERMISSIONS.md. Hosted CI 34750624157 was confirmed running for 3ad5014; no latest-main hosted pass claimed.

- Full API session 3544 FINISHED exit 0: all 1,078 tests/154 files pass (966.64s), source held unchanged through d5d4aac API changes. Index readiness, missing-policy and update-publication transactions are included; earlier timeout did not recur, original cause remains unproven. Source freeze lifted. Broader release and external gates remain open.

- Native legacy push handler now suppresses foreground banner/sound/badge/list presentation and removes payload logging/listeners. Dormant registration helpers no longer request OS permission or collect/send tokens. All 103 mobile tests, types and lint pass. Background OS delivery, legacy provider registrations and SDK component/traffic minimization remain open in PUSH_NOTIFICATIONS.md. API regression remains in progress; no API/shared edits.

- Fixed the missing Android media-projection permission using explicit Expo foreground-service permissions. Isolated prebuild and release manifest merge pass (session 95412 exit 0, 37s); parsed service/permissions/SDK/backup/blocked-permission assertions pass. Added actual device and Play Console acceptance items. API session 3544 remains confirmed live with source unchanged. See NATIVE_PERMISSIONS.md for artifact hash and provenance.

- Android session 20258 finished successfully. Parsed merged release manifest verifies SDK 36/minimum 24, backup references/all nine exclusions and six blocked permissions absent; inventory/hash recorded in NATIVE_PERMISSIONS.md. The merge exposes a missing media-projection foreground-service permission and transitive component minimization follow-ups. No signed/full native build claimed. API session 3544 confirmed live, source unchanged.

- Native upload privacy: app-owned picker cache copies are removed after upload attempts, including failures, with explicit cache/path guards and visible cleanup failure. Source documents, remote/content URIs and traversal paths are preserved. All 101 mobile tests plus final types/lint pass (`/tmp/ujimora-upload-cache-*`). Native artifact session 20258 remains live: thread inspection shows Android AAR extraction writing files, not a terminal failure (`/tmp/ujimora-manifest-thread-state.log`). Full API session 3544 remains live with unchanged API source.

- iOS backup verification: installed AsyncStorage defaults to excluding its directory; current credentials use device-only Keychain access. Foundation inspection of the existing Ujimora simulator directory confirmed isExcludedFromBackup=true without reading user data. This is simulator/source evidence, not physical restore proof. Android merge attempts 53371/55902 ended on isolated Metro dependency visibility; corrected only the temporary dependency paths/watch folder. Third attempt 20258 has passed release JS bundling and remains live before final manifest output (`/tmp/ujimora-android-manifest-merge-final.log`). Current full API session 3544 remains running with frozen API source (`/tmp/ujimora-api-current-publication-regression.log`).

- Full API session 69000 completed: 152 suites/1063 tests pass, donation-content-gate fails initially from a 120-second timeout; retry fixture accumulation then causes count assertions. Creator index-readiness regression passes. Unchanged donation test passes alone on current source (7.26s), `/tmp/ujimora-donation-review-repro.log`; original timeout cause remains unproven. Root fast-forwarded to d5d4aac after terminal result. Starting fresh current-source full regression; Android manifest session 53371 remains active. See API_REGRESSION_TRIAGE.md.

- Campaign updates now consume exact publication approval in the same transaction as final account/credential/campaign/membership authorization and create/edit persistence, including the organization-team route. Forty-eight distinct focused tests pass across existing and final suites; corrected one new fixture URL before final success. API types/lint pass. Evidence `/tmp/ujimora-update-transaction-*`. Published from isolated repair checkout so root full regression session 69000 stays on its original API source; root must fast-forward after it ends, then current regression remains required. Android manifest session 53371 is still installing the required NDK.

- Missing withdrawal policy rows now participate in serialization: absent Free subscriptions and built-in plans are atomically materialized/locked without overwriting existing policy; missing custom tiers fail with refresh guidance. Thirty creator withdrawal plus 21 plan-policy tests and API types/lint pass, including concurrent first inserts on both rails with no stale-fee funds movement. Repair published from isolated worktree; root main remains deliberately behind until full API session 69000 ends, then must fast-forward. That running regression does not include this delta. Android release-manifest session 53371 remains live compiling Gradle plugins.

- Native artifact evidence: added `scripts/compliance/inspect-ios-privacy.py`, exercised against the existing successful simulator build; output identifies platform/version/executable hash and all 16 nested manifests. Source copy has no Git provenance and is not current release evidence. Android final release-manifest merge started in isolated prebuild with installed Java 17/SDK 36, session 53371 (`/tmp/ujimora-android-manifest-merge.log`); Gradle downloaded, outcome pending. API regression session 69000 remains live, no API source changes. Hosted run 34749476008 is active for 779da7a; latest d4133c6 run is pending.

- Android backup/device-transfer rules now explicitly exclude all nine app storage domains using an Expo config plugin, replacing SecureStore-only rules while keeping cloud backup disabled. Isolated real Android prebuild passes; parsed generated manifest and both XML resources verify all exclusions. Plugin syntax/whitespace pass. Temporary workspace plugin-resolution errors were corrected before successful prebuild. Evidence `/tmp/ujimora-backup-prebuild.log`; final Gradle merge, physical restore/transfer, historical backups and iOS backup gates remain open. Full API session 69000 still running with API source frozen.

- Android cloud-backup minimization: Expo config now explicitly disables allowBackup. Before/after native introspection proves generated application attribute changed true to false and retained SecureStore resource references. Evidence `/tmp/ujimora-native-backup-{introspection,disabled}.json`; `NATIVE_PERMISSIONS.md` documents official Android guidance, new-native-build requirement, existing backup limits and unresolved device-transfer/iOS gates. API regression session 69000 remains live; API source/tests unchanged during this run.

- Native pending checkout integrity: malformed JSON, missing fields, cross-scope records and invalid optional fields now surface recovery guidance and remain preserved; checkout validates recovery state before generating keys or sending a request. Donation and wallet screens catch load errors. All 90 mobile tests, types/lint pass (`/tmp/ujimora-native-recovery-*`). Hosted CI 34748600279 is confirmed successful for older 0a48feb, not latest main. Index-readiness fix published as b18bb0c; full API regression session 69000 is currently running against that API source (`/tmp/ujimora-api-index-ready-regression.log`).

- Settings now has six focused, deep-linked tabs: Payments, Campaigns, Referrals, Notifications, Security and Appearance. Keeps visited panels mounted to retain drafts; uses working persisted policy forms, personal opt-in alert API, optional MFA and immediate browser appearance controls. Removed local-only controls and misleading global Save confirmation. Branded fields fix clipped cashout labels; initial policies have skeletons and retry errors. All 71 admin unit tests, types/lint/build pass; 14 export-placement and two focused 390/1440px browser checks pass (appearance selector corrected to switch). Screenshots inspected. Sidebar branch connectors explicitly preserved per user instruction. Logs `/tmp/ujimora-settings-*`.

- Full API regression session 99922 finished: 152 suites passed, one failed; 1063 tests passed, one withdrawal unique-index race failed. No source changed during the run. Isolated index-readiness repair has 26 withdrawal and 19 refund tests plus API types/lint passing; full regression after repair remains required.

- Browser tip recovery now validates persisted attempt shapes. An unreadable current attempt stops checkout without replacing its key; malformed unrelated entries no longer interrupt reference recording or confirmed-payment cleanup. Sixteen checkout/confirmation tests and web types/lint pass (`/tmp/ujimora-tip-storage-validation-{tests,types,lint}.log`). Full API session 99922 has progressed beyond the refund suite and remains active; its delayed-refund/rejection warning requires review of the final result. No API source/tests changed during this regression.

- Native permission audit: generated configuration exposed unnecessary legacy READ_EXTERNAL_STORAGE; explicitly blocked it and verified all six removal directives through Expo introspection. Retained WRITE_EXTERNAL_STORAGE because the installed picker requires it for camera capture below Android 10. Documented the complete generated permission inventory, iOS development-local-network declarations, policy timing and final merged-artifact/device gates in `NATIVE_PERMISSIONS.md`; updated store checklist. No signed-device or store approval claimed. Full API session 99922 and hosted CI 34748600279 remain active at last poll.

- Native payment-storage privacy: request lookup keys now use SHA-256 instead of embedding checkout JSON/contact details/messages. Matching legacy requests preserve their original idempotency UUID and remove plaintext keys only after durable replacement; failed-save recovery is tested. All 84 mobile tests pass after updating the creator checkout crypto mock; mobile types/lint and iOS/Android/web exports pass. Logs `/tmp/ujimora-mobile-payment-storage-{tests,export}.log`. Untouched legacy entries, pending checkout references/URLs, logout cleanup and signed-device/backup evidence remain open in `STORE_DATA_INVENTORY.md`.

- Fresh full API regression started from API source at 0754a37: session 99922, `/tmp/ujimora-compliance-api-regression.log`. It is still running; no API source or tests changed during this run. Do not infer completion from focused suites or this start record. Hosted run 34748600279 also remains in progress at last check.

- Export-menu design follow-up complete: shared menu now uses the branded raised surface, heading/guidance and subtle SVG watermark. PDF, Excel and CSV each have a tone-colored icon, title and accessible description, with visible keyboard focus and phone-width wrapping. Seventeen browser cases pass, including all three real downloads and authorization revocation; 390/1440px menu screenshots inspected. Admin types/lint/build pass with existing warnings. Evidence `/tmp/ujimora-export-menu-{browser,build}.log`; `apps/admin/AGENTS.md` now requires this convention for future export menus.

- Comment attribution now persists the approved name/photo with new comments and never substitutes later account identity. Legacy comments use a neutral label/no photo; erasure removes snapshots from active and previously hidden records. Reports capture the displayed snapshot. All 32 focused API tests plus three safety-report cases pass; existing report assertions were scoped to their fixture after adding a new case. API types/lint pass. See `ACCOUNT_PUBLICATION.md`. Hosted CI 34747475179 is terminal failed: 52 web browser cases passed and the 12 failures match fixtures repaired in later commits; 34748600279 is now running. Current full hosted verification remains open. User's export-menu design follow-up is in progress separately.

- Blocking concurrency follow-up: block/unblock now commit both participant-account publication writes with the relationship change, so comment publication and block changes serialize. Reciprocal blocks use stable account ordering; provider cleanup remains retryable outside the transaction. Twenty-eight publication/block/live-safety integration tests pass; all four block cases pass again with malformed unblock-ID validation. API types/lint pass. Evidence and remaining read-only block consumers are recorded in `docs/compliance/PUBLICATION_SCREENING_AUDIT.md`. Hosted CI 34747475179 remains in progress at the E2E stage; latest-main hosted verification and broader compliance remain open.

- Admin export placement complete: reviewed all 37 export sites, moved 27 page-wide exports into PageHeader actions, and grouped CMS, campaign history, split proceeds, privacy retention and crypto exports with their related controls or section headings. Existing queue toolbars remain grouped. Responsive action wrapping preserves branded surfaces and SVG watermarks. All 28 targeted browser checks pass (14 placement cases at 390/1440px, actual CSV/XLSX/branded PDF downloads, authorization revocation, campaign review and queue states); representative screenshots inspected. All 71 admin unit tests, types, lint and build pass, with existing lint/chunk warnings. Browser/build evidence: `/tmp/ujimora-export-placement-{browser,build}.log`. Admin conventions now require contextual export placement. Broader compliance and production deployment verification remain open.

- Notification follow-up: malformed unread counts/inbox records now produce a retry error and unavailable badge; older overlapping refreshes cannot replace newer state. Header bells remount per account and invalidate pending requests on cleanup. Ten bell tests and shared UI/web/admin type/lint tasks pass (`/tmp/ujimora-bell-validation-{tests,checks}.log`). Admin export-placement review is now active per user request.

- FULL WEB BROWSER PASS: all 64 cases, one worker, isolated seeded API, session 32055 terminal exit 0 (2.7m), `/tmp/ujimora-web-full-browser-tests.log`. Covers current consent/signup, KYC private-evidence intake, wallet rejection/top-up, privacy, opt-in alerts, MFA, publication and website-request flows. No provider/device/store verification inferred. Nonfatal NaN badge warnings originate from incomplete unread-count mocks reaching NotificationBell; robust response validation remains a follow-up. Hosted CI 34747475179 (older 167a5be) is still verified running; latest publication queues behind it.

- Remaining KYC/donation fixture corrections: address browser tests now supply required personal details, private ID front/back and selfie references, assert that missing evidence blocks progress, and verify GhanaPost GPS replaces only address-proof upload. Three KYC/browser checks pass. Real API-backed wallet donation rejection passes using current wallet action; missing seed now fails instead of silently skipping. Logs `/tmp/ujimora-{kyc-address,donation-browser}-tests.log`. Full web browser regression now running with one worker against isolated seeded local API: session 32055, `/tmp/ujimora-web-full-browser-tests.log`; do not infer completion before its terminal result.

- Hosted web E2E follow-up: corrected real registration fixtures to traverse account/details/plan, explicitly accept both agreements, and provision login accounts with required acceptance. Five real API-backed auth/campaign browser checks pass. Publication-review responses now validate shape before rendering and show a retry error instead of crashing surrounding settings on malformed data; 12 unit tests plus web types/lint pass. Corrected review/payout mocks and network-picker/idempotency assertions; four settings consent/privacy browser cases and both creator-plan cases pass. Logs `/tmp/ujimora-{auth-browser-tests,settings-browser-tests,creator-plan-browser-tests,review-response-unit,review-response-types,review-response-lint}.log`. Creator fixtures still emit a nonfatal NaN console warning; full hosted rerun, remaining KYC/donation cases and external compliance gates remain open.

- Screenshot follow-up: all six review/operations pagination rows now reuse the existing raised PaginationBar, with server-backed 12/24/48 sizes, range/number navigation, theme-aware disabled controls and no empty/loading/error pager. Refund/store toolbars now have descriptive labels, SVG watermarks and aligned refresh/export controls. Existing 25-item API defaults remain compatible; explicit sizes are bounded to 1–100 across eight endpoints. Nine API tests and all 71 admin tests pass; 24 distinct browser cases pass across initial run plus corrected privacy fixture rerun, with final refund mobile alignment rechecked. API/admin types/lint and admin build pass. Logs `/tmp/ujimora-queue-pagination-*`; screenshots inspected at 390/1440px. Updated admin conventions.

- Hosted CI 34746434640 (older head 5e68a03) finished with a web E2E failure after earlier test-stage success: 51 web cases passed, one flaky, remaining failures recorded in `/tmp/ujimora-hosted-34746434640-failure.log`. Full hosted release verification remains open; do not infer latest-main green.

- Comment creation now commits current credentials, author identity, campaign access and exact approval with insertion in one transaction. All 19 publication integration tests plus API types/lint pass; competing approval rejection retries and leaves no comment. Logs `/tmp/ujimora-comment-transaction-{tests,types,lint}.log`. Concurrent block insertion and later dynamic identity projections remain open.

- Comment admission now binds the public author name and avatar alongside comment text, covering registration identity on this publishing path. Avatar submissions require the existing staff media workflow; a changed identity during screening denies creation. Admin/web/native evidence formatting recognizes structured comment evidence. Seventeen publication API tests, eight admin and seven web review tests pass; all four app type/lint tasks pass. Logs `/tmp/ujimora-comment-attribution-{tests,admin,web,checks}.log`. Initial stale text-only screening assertion corrected. Other identity projections, legacy content, media-byte evidence and final comment transaction fencing remain open.

- Background account cleanup now advances the retention-review revision when pending cleanup completes, invalidating forms based on the previous evidence state. It preserves staff notes and the chosen follow-up date; repeated sweeps do not keep advancing the revision. Four erasure tests and API types pass, sessions 52066/86538 terminal 0; `/tmp/ujimora-cleanup-review-revision-{tests,types}.log`. Hosted CI 34746434640 remains verified running its test stage. Broader compliance remains active.

- Retention-review saves now require the displayed revision, reject competing/stale saves, recheck current admin credentials inside the transaction, and commit a minimal audit event with the review. Legacy records without revisions accept initial revision zero. Admin sends the revision and preserves notes on failure with a refresh action. Four erasure integration tests plus one admin interaction test pass; API/admin types/lint pass. Logs `/tmp/ujimora-retention-review-{tests,admin,checks}.log`; sessions 61037/37084/15257 terminal 0. Retention schedules, processor erasure and full compliance remain open.

- Redesigned Publication Reviews, Safety Reports, Privacy Requests (including data rights), Refund Recovery and Store Billing using existing PageHeader SVG watermarks, illustrated EmptyState, branded fields and raised surfaces. Shared review-card skeletons cover initial/refresh loads; responsive toolbars group filters/refresh/export. Error states never claim empty queues. Twelve mocked browser checks pass at 390/1440px, including populated review conflict/retry; screenshots inspected. All 70 admin tests pass with CI=true/one worker after one loaded-run KYC timing failure; admin types/lint/build pass (existing lint/chunk warnings). Logs `/tmp/ujimora-admin-queues-{tests-serial,browser,types,lint,build}.log`. New apps/admin/AGENTS.md records the user-requested conventions for future UI. Production deployment itself remains unverified.

- CI concurrency now preserves running main checks while queuing the latest pushed revision; superseded PR checks remain cancellable. Repeated main cancellations were observed in hosted runs 34746357533/34746292172. Workflow YAML and actionlint validation pass with two existing unused-loop-variable shellcheck warnings. This supports incremental publication without restarting the full API/E2E run on every push; a hosted full pass remains unproven.

- Data-rights reviews now serialize current staff role, credential version and nonclosed account inside the response/audit transaction. Eight data-rights integration tests, API types/lint pass; role removal, credential rotation and closure after authentication deny without changing the request/revision/audit history. Logs `/tmp/ujimora-rights-authorization-{tests,types,lint}.log`, sessions 61554/60923/62875 terminal exit 0. Publishing incrementally; complete access-data fulfilment, retention/processor and other staff-action requirements remain open.

- Live transaction concurrency evidence: a separately committed approval rejection after the transaction snapshot forces retry and denial with no session/campaign fence committed; simultaneous starts of an approved funded campaign return the same session/token with funds unchanged. All 15 publication integration tests pass (session 24781 terminal 0, `/tmp/ujimora-live-concurrency-tests.log`). No runtime source changed. Remaining live/provider/device and wider compliance gates stay open.

- Live creation now commits current account/credential/role/restriction checks, campaign eligibility, exact approval, plan entitlement and session insertion in one transaction. Existing plan/subscription records participate in conflict detection. Twenty-seven API publication/live tests, API types/lint pass; four after-screening revocations leave no session and roll back campaign scheduling writes. Logs `/tmp/ujimora-live-transaction-{tests,types,lint}.log`; sessions 79992/32495/19880 terminal exit 0. Publishing incrementally. Detailed concurrent interleavings, absent-plan insertion policy, native/provider and broader compliance gates remain open.

- Live-session metadata now uses private exact-version admission before session/token creation. Web/native offer unchecked automated consent and existing decision lists; held drafts are retained. Twenty-three API publication/live tests, six web studio tests and 81 native regression tests pass; API/web/native types/lint pass. Logs `/tmp/ujimora-live-admission-{tests,web,mobile,checks}.log`; sessions 78673/36245/50445/45540 terminal exit 0. Publishing incrementally. Final transaction fencing, signed-device/rendered checks and live audio/video moderation remain open; see PUBLICATION_SCREENING_AUDIT.md.

- Crypto recovery now includes stale records without references and reports them separately as blocked, along with unavailable-provider IDs/reasons. Admin shows investigation guidance and explicitly selected export columns without donor details. Twelve API integration tests and one admin display/export test pass; API/admin types/lint pass (existing admin ref warning only). Logs `/tmp/ujimora-crypto-issues-{tests,admin,checks}.log`; sessions 19953/72398/29485 terminal exit 0. Publishing incrementally. Authoritative provider recovery and external approvals remain open; no manual paid-status override added.

- Manual crypto recovery rejects malformed, negative and out-of-date-range ages before querying deposits. The shared use case also enforces batches of 1–100, preventing Mongo limit=0 from creating an unbounded sweep. Eleven crypto integration tests, API types/lint pass; HTTP authorization/default/zero-age and direct scheduling controls covered. Logs `/tmp/ujimora-crypto-controls-{tests,types,lint}.log`, sessions 82055/88336/76867 terminal exit 0. Incremental publication; missing-reference/provider operations and broader compliance gates remain open. Hosted CI 34745663334 verified running its Test step after successful install/lint/types.

- Crypto recovery rotates attempted deposits using separate scheduling metadata, so a persistently failing oldest batch does not exclude newer deposits indefinitely. Nine crypto integration tests, API types/lint and whitespace checks pass; bounded-batch retry preserves amounts/status/financial timestamps. Publishing the focused follow-up; provider/authorization and broader compliance gates remain open.

- FULL API regression PASS: 1,029 tests across 151 files, session 48519 terminal exit 0 (1091.24s), `/tmp/ujimora-publish-api-tests.log`; source freeze lifted. CI fca28d3 failed on a 5s mobile timeout while package suites competed for CPU. Follow-up limits CI to one package/one client worker and aligns admin/mobile timeout with web (30s); unchanged assertions pass under CI=true: web 178, admin 69, mobile 81. Publishing this verified CI fix separately.

- Engineering checkpoint fca28d3 pushed to main; ls-remote verified exact parity at fca28d3b47a3dc29a996451700a36e99f0162b23. User authorized continued incremental fixes/pushes. CI run 34745173463 passed clean install, dependency-patch tests and replica-set setup and remains active; local full API session 48519 remains active. No source edits while local regression runs.

- User explicitly authorized incremental fix-and-push delivery. Publishing the tested engineering checkpoint now, keeping the complete compliance goal and unresolved requirements active. Web one-worker full rerun passes all 178 tests; all client suites, types, lint, builds and patch checks pass. Full API session 48519 remains in progress and its result will be recorded separately.

- Publishing checkpoint in progress at user request: verified engineering changes staged separately from personal files, DOCX drafts and output. Origin/main fetched and matched HEAD before staging. All seven package type/lint tasks, web/admin/marketing builds, dependency patch checks, admin 69 tests, mobile 81 and shared UI 24 tests pass. Web 178-test suite rerunning with one worker after seven loaded-run failures; full API session 48519 remains running. Compliance goal remains active and release approval is not claimed.

- Crypto recovery now isolates apply/settlement errors per deposit and reports persisted outcomes instead of treating every provider confirmation as settled. Eight HTTP crypto tests, API types/lint and whitespace checks pass; failed-first/successful-second recovery, safe retry and insufficient-finality summary covered. Broader recovery/provider/release gates remain open.

- Full API session 5623 FINISHED exit 1: 1,023 passed, four failed across campaigns/short-links (151 files, 628.77s). Source freeze lifted. Failures were outdated multi-campaign fixtures missing current evidence; all 27 tests in those files now pass. Crypto intake shutdown no longer suppresses scheduled recovery; six crypto integration tests, API types/lint and whitespace checks pass. Fresh full clean regression still required.

- Read-only crypto audit found scheduled recovery incorrectly coupled to new-intake enablement; manual reconciliation/webhook wiring remains independent. Map and next disabled-intake/recovery test are in CRYPTO_RELEASE_GATES.md. Full API regression session 5623 is still live; preserve source until terminal, then fix recovery coupling.

- Fresh FULL API regression running against the expanded verification/withdrawal changes: session 5623, `/tmp/ujimora-compliance-api-expanded-regression.log`. API/shared source frozen until terminal; do not restart based on elapsed time. Primary Apple/Google/BoG requirements refreshed; crypto authorization remains unproven despite default-off feature configuration.

- Existing subscription and plan records are now written during both withdrawal fee checks, forcing transaction conflicts with concurrent edits. Thirty-seven creator/wallet tests pass, including four post-snapshot policy mutations across both rails; API types/lint and whitespace checks pass. Missing-record fallback/insert races and wider compliance remain open.

- Creator wallet transfers now resolve fee consent inside their debit/credit/ledger transaction using the production plan service. Thirty-five creator/wallet tests, API types/lint and whitespace checks pass, including plan edit and subscription expiry before commit. Concurrent policy-document mutation serialization and remaining compliance requirements stay open.

- Creator bank withdrawal re-reads the effective fee inside its final reservation transaction. Twenty-two creator integration tests pass, including admin fee change and subscription expiry after initial consent check; API types/lint and whitespace checks pass. Wallet fee parity and concurrent plan/subscription mutation serialization remain open.

- Creator bank reservations now conditionally write the exact saved destination inside the transaction, requiring its name-match status and unchanged recipient/account details. Twenty-eight creator/account tests, API types/lint and whitespace checks pass; removal, status revocation and detail changes deny before funds/provider transfer. Other financial consumers and dynamic fee/applicability/release gates remain open.

- Creator bank/mobile-money reservations now commit current account authorization, debit and PROCESSING reference in one owner-serialized transaction. Twenty-eight creator/wallet tests pass, including revocation, full rollback/retry, concurrent identical requests and provider observation of committed state. API types/lint and whitespace checks pass. Dynamic fees/destination/evidence applicability and wider compliance remain open.

- Creator-to-wallet transfers now carry the authenticated credential version into their existing transaction and serialize a current nonclosed account check before any debit/credit. Twenty-four wallet/creator tests pass, including closure and credential rotation after authentication; API types/lint and whitespace checks pass. Bank-rail final authorization and provider-specific identity applicability remain open.

- Creator withdrawal replay now verifies payout ownership on both initial lookup and duplicate-key recovery. Eleven transfer integration tests, API types/lint and whitespace checks pass; cross-account retries disclose no payout and the simulated competing insert restores the losing reservation. Current-evidence and final transaction protection for creator withdrawals remain open.

- Account KYC aggregate status/level now use the latest review per type; older approvals cannot mask newer pending/rejected/expired submissions. Historical decisions remain available. Thirty-six KYC integration tests, API types/lint and whitespace checks pass. Undated legacy approvals, remaining consumer policies and full release requirements stay open.

- Public member profiles now project current evidence-backed verification levels, shared with campaign allowance calculation. Fourteen public profile/organization/allowance tests, API types/lint and whitespace checks pass. Historical levels remain stored; current role, expiry and supersession affect public badges. Remaining status/political/media/payout/provider/release requirements stay open.

- Public organization list and slug/id badges now require latest approved unexpired business evidence in addition to the institutional level. Five public-access integration tests, API types/lint and whitespace checks pass; missing/undated/expired/superseded evidence hides the badge without exposing KYC details or altering history. Other public badge consumers and full compliance remain open.

- Campaign creation revalidates/serializes the exact content approval inside the final transaction, denying expired/rejected/deleted reviews without rerunning screening. Twenty-six focused tests, API types/lint pass; three new HTTP interleavings prove no campaign is inserted. Remaining consumer/plan/publication paths and full compliance remain open.

- Six authenticated campaign-creation revocation interleavings pass: closure, credentials, agreement, restriction, expired and newer pending KYC are denied after screening/before final transaction, preserving the original campaign. Ten plan/race integration tests and API types pass. Admission-review expiry/revocation and other compliance consumers remain open.

- Final campaign creation checks and insert now share an owner-serialized transaction; screening stays outside and alerts follow commit. Concurrent last-slot HTTP test yields one 201/one 403 and one campaign. Twenty-four creation/review/plan/policy tests, API types/lint pass; revocation interleavings and remaining compliance consumers stay open.

- Staff campaign approval now enforces current evidence-backed allowance inside the transaction, with owner serialization against account/KYC writes. Fourteen staff-review/approval-policy/plan tests, API types and lint pass; expired evidence denial preserves funds/history and renewal permits review. Concurrent creation-count fencing and remaining consumers stay open.

- Campaign allowance now uses latest unexpired evidence in creation options and both creation checks; stale high levels fall back to the existing baseline allowance. Nineteen focused tests pass, including supersession/expiry/role and HTTP parity; existing campaigns/history preserved. API type-check and affected lint pass; campaign review/public badges/other payouts and broader compliance remain open.

- Full API regression FINISHED: 989 tests across 150 files pass (684.07s); session 70687 terminal exit 0, `/tmp/ujimora-compliance-api-final-regression.log`. API/shared source freeze lifted. Client suites/builds and current Expo diagnostics/export checkpoints remain recorded below. Next: current-evidence campaign allowance/review and other remaining consumers; full compliance and commit/push not complete.

- Organization web intake passes at phone and desktop widths, including private uploads, declaration gate, failure/retry and no overflow; desktop screenshot inspected. Browser/lint sessions terminal. Full API regression 70687 remains running; preserve its source and poll before backend changes.

- Current Expo Doctor passes 20/20; store checklist updated with current diagnostics and separate clean-install/signed-device gates. Full API regression session 70687 remains running; source frozen for that run, no full release pass claimed.

- Current web/admin production builds pass with large-chunk warnings. Read-only remaining-consumer map recorded in KYC_REVIEW_INTEGRITY.md (campaign allowance/review, organization badges, creator withdrawals). API regression session 70687 remains live; no API/shared edits until terminal.

- Fresh Expo iOS/Android/web JavaScript exports pass at `/tmp/ujimora-compliance-kyb-mobile-export`; signed/device evidence remains open. Two dedicated admin organization evidence tests and admin types pass. Full API session 70687 remains running: keep API/shared source unchanged and poll to terminal.

- Broad client regressions FINISHED: mobile 81/21 files, web 178/47 files and admin 67/17 files all pass. Full API regression remains live in session 70687 (`/tmp/ujimora-compliance-api-final-regression.log`); poll to terminal before API/shared edits. C13/C18 readiness rows reconciled. No full release pass or commit/push yet.

- Full API regression running in session 70687 (`/tmp/ujimora-compliance-api-final-regression.log`); keep API/shared source unchanged until terminal. Full mobile regression also started. C13 readiness row reconciled with current organization/payout evidence; C18 stale biometric wording corrected. No full release pass claimed.

- Automatic payout race evidence complete for five pre-lock revocations (closure/email/role/new pending/rejected KYC): transaction retries deny stale authorization and preserve funds. Real approval test proves provider sees committed reservation/reference first. Twenty focused payout tests and API types pass; broader compliance and release work remain open.

- Automatic payout authorization, account serialization, money reservation and PROCESSING transition now commit together; provider calls remain outside the transaction. Fourteen tests cover rollback/retry and existing payout uncertainty; API types/lint pass. Detailed concurrent revocation evidence and other compliance consumers remain open.

- Automatic transfer approval rechecks current owner/evidence after provider balance lookup, before reserving money. Missing checker fails closed. Thirteen payout/revalidation/uncertainty tests, API type-check and lint pass. Atomic reservation/authorization race, other privilege consumers and full compliance remain open.

- Automatic payout selection now requires latest unexpired identity/business evidence, not only a stored verification level. Ineligible evidence stays in manual review without automatic budget claims; organization evidence is distinct from personal ID. Eight integration tests, API types and affected lint pass. Transfer-time revalidation, other campaign/payout consumers and full compliance remain open.

- Expired KYC status corrected: elapsed explicit expiry dates no longer count as approved in status/level responses; history remains intact and renewal is available. Native expired badge/date/renewal and web guidance connected. Thirty-three API, four native screen and three web tests pass; types/lint pass. High-value auto-approval already checks expiry; other stored privilege consumers and undated legacy policy remain open.

- Native organization form interaction tests pass for declaration gating, failed-save preservation, disabled save controls, identical retry, success clearing/status navigation and ID-type replacement. Native upload/date controls now support explicit disabled state. Two screen tests, mobile types and affected lint pass; physical device/export and remaining compliance checks stay open.

- Native verification status cards now show actual application types, removing the incorrect account-wide-level fallback that mislabeled business/address records. Three screen tests, mobile type-check and affected lint pass. Organization form interaction/device checks and broader compliance remain open.

- Native organization intake implemented at `/kyc` for organization accounts: full representative/control declarations, private uploads, country choices, draft-preserving failures and confirmed-success status link. Eight native payload/identity tests, mobile types and affected lint pass. Native screen interaction/device and final export checks remain unverified; compliance and commit/push stay pending.

- Organization web phone workflow verified with routed organization session, three private uploads, controlling-person add/remove, required declarations, failed-save preservation and successful identical retry. Screenshots inspected; no horizontal overflow or browser console errors. Custom date/upload controls explicitly disable during work. Web type/lint pass; native intake remains next.

- Web organization verification form connected to `/kyc/business`: private evidence, multiple controlling persons, unchecked declarations, upload/save guards and preserved failed entries. Organization accounts use it at `/kyc`; status/history refresh after submission. Eight focused web tests, type-check and affected lint pass. Native form and browser layout verification remain next; broader compliance and commit/push remain pending.

- Organization approval now rejects incomplete historical/new evidence: active organization role, registered address, adult representative identity/authority, declared control persons and timestamped declarations are required. All 35 KYC integration tests, API type-check and affected lint pass; processes terminal. Applicant web/native intake and remaining provider/policy/release work stay open.

- Organization intake API now saves registered address, representative identity/authority, controlling persons and declarations with private evidence and transactional audit. Three new integration tests and five existing admin review tests pass; API/admin types and affected lint pass. Staff detail displays these declarations. Web/native intake, full approval prerequisites and broader compliance/release work remain open; see `KYC_REVIEW_INTEGRITY.md`. All focused sessions terminal.

- Organization/address minimum evidence added: business legal name/registration number/private registration evidence; address country/city plus supported GPS or private documentary proof. Address approval no longer grants National ID privileges. All 32 KYC integration tests, API type/lint pass. Full KYB authority/ownership/submission workflows, political/media policy and remaining compliance/release work stay open.

- KYC revocation races verified: 14 new authenticated-request interleavings cover staff role/closure/credential changes, applicant closure and revoked applicant responses; no stale mutations/audits occur. All 30 KYC integration tests and API type-check pass; sessions terminal. Next confirmed gap: non-identity records can still promote privileges without type-specific evidence prerequisites. See `KYC_REVIEW_INTEGRITY.md`; broader compliance and commit/push remain pending.

- Staff evidence review made explicit: full-detail approval requires findings and confirmation, version-bound audit records the declaration, and summary pages cannot approve directly. Sixteen API tests, five admin tests, four phone flows plus application-link coverage, type/lint checks pass. Non-identity/legacy evidence policy, account/role races, provider/retention and final compliance release work remain.

- Initial ID selection corrected across web/native: shared ID-card/passport/licence choices, exact saved types, passport photo page without back image, old ID/selfie clearing on type changes and upload busy guards. Three web and five native tests, type-checks and lint pass; all focused sessions terminal. Staff evidence diligence, legacy/non-identity policies and wider release work remain.

- KYC rejection guidance completed: both admin pages require a saved applicant-facing reason; web/native show it with a corrected-submission path while private staff notes remain excluded. Fifteen API, five admin, four web and two native screen tests pass; four app type-checks, lint and phone browser flow pass. Test sessions terminal. Evidence diligence, identity-type/legacy work, full compliance checks and commit/push remain.

- Identity evidence minimum implemented: full name/adult DOB plus an owned available ID reference; absent/selfie/address-only evidence cannot approve. New selfies have a separate type across API/web/native, with matching web wizard checks. Fourteen API, three web and six mobile tests plus types/lint pass. Legacy labels, staff evidence diligence, rejection/correction UX and full release work remain; see `KYC_REVIEW_INTEGRITY.md`.

- KYC private-document race closed: transactional ownership/availability writes now cover approval, initial submission and response attachments. Thirteen integration tests, API type/lint pass, including mid-review withdrawal and rollback. BoG revised notice/guidance rechecked; regulated identity/liveness/MFA applicability recorded in `RFI_KYC_APPLICABILITY.md`. Minimum ID evidence, selfie type separation and wider release work remain; all focused sessions terminal.

- KYC stale reviews fenced: staff queue supplies a persisted-application fingerprint; approve/reject/request-info require it inside the transaction, and accepted audits record it. Alternate Verifications page now preserves pending status on save errors. Eleven API tests, three admin tests, two phone browser flows, API/admin types and affected lint pass. Document-evidence acceptance, role/account races, retention and final release work remain; all focused sessions terminal.

- KYC information-request screens connected across admin/web/mobile: durable staff prompts, applicant private uploads/responses, history, retries and refresh. Six focused component tests, all three type-checks, affected lint and phone web/admin workflows pass. Reviewed-version decision fencing, evidence/retention work, final release regression and commit/push remain; see `KYC_REVIEW_INTEGRITY.md`.

- Durable KYC information-request API implemented and verified: private request/response history, current-account transactions, pending-queue return, owned private attachments, outstanding-request approval denial and audit rollback. Ten integration tests, API type-check and affected lint pass. Staff/web/native UI wiring, reviewed-version fencing, evidence/retention work and final release checks remain. All focused test sessions are terminal; see `docs/compliance/KYC_REVIEW_INTEGRITY.md`.

- KYC account promotion narrowed: atomic max update changes verification level only, cannot demote, and refuses closed accounts. Eight integration tests, API type/lint pass; unrelated account fields are preserved. Durable information requests, evidence validation and release checks remain.

- KYC submission race closed in HTTP workflow: applicant-row transaction serialization yields one active submission under concurrent requests and permits a fresh attempt after rejection without deleting history. Seven KYC integration tests, API type/lint pass. Durable information requests, document evidence and further race/release checks remain.

- KYC transactional review implemented: HTTP decisions fence current staff/applicant, deny self-review, and commit KYC status, verification level and audit together. Six KYC integration tests plus API type/lint pass, including audit rollback and competing decisions. Submission uniqueness, information-request workflow, further race evidence and release regression remain.

- API repair FINISHED: all 60 tests across the eight previously failing files pass; API type-check/diff checks pass. Sessions 81527 and 27562 are terminal. Every observed full-run failure is reconciled; final full sweep remains after backend KYC transaction/information-request work. See `API_REGRESSION_TRIAGE.md`.

- API full run FINISHED: 900 passed, 46 failed across eight files (147 total). Consent and reviewed-attribution fixtures corrected without weakening production gates. Eight-file repair run is now active in session 27562 (`/tmp/ujimora-compliance-api-repair.log`); session 81527 is terminal. Await repair results before more API/shared edits.

- Read-only KYC backend audit confirmed separate approval/account writes, unfenced competing decisions and non-atomic active-submission checks. Recorded concrete transaction/race/rollback acceptance work in `docs/compliance/KYC_REVIEW_INTEGRITY.md`. API regression session 81527 remains live; preserve API/shared source until it finishes, then reconcile failures and implement this gap.

- KYC browser verification: phone failure/retry/reopen flow passes; selected record and counters now reflect confirmed local decisions. Two component tests plus final type/lint pass; error-state screenshot inspected. API full regression still running in session 81527; await terminal before API/shared edits.

- KYC admin persistence corrected while API regression runs: approve/reject display changes only after confirmed save; failures remain visible/retryable, and Request More no longer fabricates an in-review state. Two admin tests, type-check and affected lint pass. Durable information-request workflow remains open. API session 81527 remains active; do not edit API/shared code until terminal.

- Release build checkpoint: web/admin production builds pass (bundle-size warnings remain). API session 81527 is still live; payout and related financial checkout helpers contain missing public-name acknowledgement candidates. No API/shared source changed during the run. Continue polling the same session, then resolve final failures.

- Broad regression running: all 170 web tests pass; all 62 admin tests pass on full single-worker rerun after one parallel-run timeout. Full API run is still active (exec session 81527; `/tmp/ujimora-compliance-api-regression.log`), with payout consent-fixture failures observed. Poll that session to terminal before editing API/shared source, then reconcile all failures. No full release pass claimed.

- Post-donation message editor closed: current acknowledgement required, edits atomically requeue content and clear previous review metadata, hidden/revoked attribution remains protected and money unchanged. Ten API integration tests, API type and affected lint pass. Google Play UGC requirement rechecked; legacy acceptance evidence and broader compliance audit remain.

- Mobile payment isolation: status component now resets itself across payment/reference changes; late prior responses cannot replace the current review. Two component lifecycle regressions and all 69 mobile tests pass, plus mobile type/lint and iOS/Android/web exports. Mocked native controls do not prove physical-device checkout; legacy consent and broader release gates remain.

- Later donor review decisions: web fiat/crypto and mobile success screens now expose refresh; web failures clear stale review labels while preserving confirmed payment. Nine web tests, three crypto browser tests, web/mobile type-check and affected lint pass. Native runtime, legacy consent approval and broader compliance requirements remain.

- Campaign donor queue exports verified: browser CSV/XLSX/PDF downloads retain status and fetch all 26 rows across 25-row server pages. Excel rows and last-record contents checked; all five PDF pages inspected with embedded Outfit, logo, forest/gold palette, watermark and numbered headers/footers. Native runtime, legacy consent and broader release gates remain.

- Settlement-to-review feedback verified for local wallet and mocked Paystack/Flutterwave/crypto webhooks. Twenty-two provider tests and the final seven donation-intent tests pass after updating a legacy consent fixture. Both tip/donor staff phone-browser conflict/refresh/approval flows pass; donor screenshot inspected. Native runtime, legacy terms, queue downloads and full release audit remain.

- Donation feedback HTTP verification: real Mongo/Express pending/approval/edit/revocation/missing-link checks pass, with no private text in responses and no-store polling. Four API integration tests plus two phone fiat consent flows and API type/controller lint pass. Provider settlement linkage, native runtime, legacy terms and remaining compliance requirements stay open.

- Donation review feedback: public polling/hosted verification resolve ledger-linked current review state without submitted text; web fiat/crypto and mobile confirmation copy separates review from payment success. Nineteen API tests, eight web tests, three crypto browser tests, API/web/mobile type-check and affected lint pass. Mongo/HTTP linkage, native runtime, legacy approval terms and broader release verification remain.

- Campaign donor name-only terms: fiat/crypto API admission and web/mobile forms now require current explicit acknowledgement for public names without messages; anonymous private names remain exempt. Nine API tests, three crypto browser tests, API/web/mobile type-check and affected lint pass. Remaining: fiat/native consent coverage, legacy approval terms and donation review-status feedback; see `docs/compliance/DONATION_CONTENT_REVIEW.md`.

- Creator tip checkout safety: API scoped request reservation, payload conflict detection, saved checkout replay and unknown-outcome retry protection implemented. Fifteen API tests including real Mongo concurrent reservation and replay pass. Web durable attempt keys and confirmed-terminal release implemented; three web tests, phone-browser lost-response/reload flow and type/lint pass. Expo-web retry/terminal lifecycle and explicit message terms implemented; 66 mobile tests, type/lint and all-platform exports pass. HTTP/callback evidence, lifecycle cleanup and public attribution admission remain open; see `docs/compliance/TIP_CHECKOUT_SAFETY.md`.

- Tip checkout lifecycle: terminal transitions and account erasure remove checkout credentials; late writes cannot restore them. Terminal retries return confirmation. Twenty focused API checks, three HTTP erasure checks and final five-test Mongo race suite pass; API type/lint and mobile type-check pass. Historical cleanup, abandonment recovery and remaining checkout HTTP/callback evidence stay open.

- Tip HTTP/callback evidence: fully wired Express/Mongo checkout test passes key validation, replay, conflicts, no-store and terminal routing; provider/entitlement mocked. Phone browser passes lost-response retry, pending key retention, confirmed success cleanup and fresh-key subsequent gift. Historical retention and abandoned initialization recovery remain open.

- Unknown tip outcome recovery: retries without saved provider credentials now open confirmation for the reserved reference without another charge initialization. Web reference changes clear old results, and web/Expo-web storage failures do not hide confirmed status. Fourteen API, five web and eight mobile tests plus all three type-checks pass. Truly unresolved provider states still require reconciliation/support.

- Historical tip checkout cleanup implemented: startup and guarded five-minute production sweep remove terminal credentials in batches of 500, preserving pending attempts and financial references/values. Seven Mongo/HTTP tests and API type/lint pass; 502-record fixture verifies bounded/idempotent cleanup. Production execution remains deployment evidence. Next: public supporter attribution admission and unresolved provider disposition.

- Creator-tip public content review implemented in progress: unapproved/legacy names and messages withheld while money settles normally. Staff queue supports exact-text decisions, transactional audit, self-review denial and existing exports. Seven API and six admin tests, API/admin type-check and lint pass. Approved-version read binding, adversarial lifecycle tests, feedback/action counts and browser/build evidence remain; see `docs/compliance/TIP_CONTENT_REVIEW.md`.

- Tip review approval binding: stored fingerprints now bind creator/supporter and the exact public content/suppression state. Changed text and legacy approval flags cannot publish without matching evidence. Final eight API integration tests pass, including stale public reads, legacy re-review, rejection/funds preservation and audit-failure rollback. API type/lint pass. Queue repair, lifecycle/feedback and browser/build evidence remain.

- Tip review feedback and discovery: web/Expo-web confirmation separates paid status from pending/approved/declined content. Reference verification exposes status only. Action-center count shares the queue filter and opens the supporter queue directly. Ten API, five web and seven admin tests plus four-app type-check pass; affected lint has no errors. Lifecycle repair, browser/build and broader donor-content coverage remain.

- Tip review lifecycle/browser: self-review, restricted/closed supporters and demoted staff denied; conflicting concurrent decisions commit one audit. Account erasure removes duplicate tip review notes/fingerprint while preserving money. Seven API tests, phone-width admin conflict/refresh/approval flow and admin build pass; screenshot inspected. Broader audit retention, queue repair and public/native verification remain.

- Tip public confirmation verification: two phone browser flows pass review feedback and checkout retry/terminal lifecycle; pending/declined screenshots inspected. All 67 mobile tests, web production build and iOS/Android/web exports pass. Next: stale approval queue repair, campaign donor attribution and remaining compliance requirements.

- Tip safety-removal queue repair: removed messages invalidate prior approval and return remaining public names to review. Empty anonymous attribution is excluded. Seven API tests prove stale-version rejection, name-only reapproval without message restoration and preserved funds; API type/lint pass. Next: name-only terms acknowledgement and campaign donor attribution admission.

- Tip name-only terms: public names now require explicit current adult/content acknowledgement before payment reservation; anonymous name-only support remains exempt from public-content acknowledgement. Web/Expo-web controls updated. Eleven API tests, phone browser flow and API/web/mobile type-check plus affected lint pass. Next: campaign fiat/crypto donor attribution admission.

- Campaign donor attribution audit/snapshot: mapped fiat/crypto settlement, REST, outbox/SSE, overlays and private history. Shared settlement now preserves submitted donor name and terms acknowledgement without adding email. Three real Mongo snapshot tests plus 18 verification regressions and API type/lint pass. Public admission/staff feedback not yet enforced; see `docs/compliance/DONATION_CONTENT_REVIEW.md`.

- Campaign donation public admission gate wired: fingerprint-bound snapshots protect recent/campaign reads, overlays, outbox and SSE; donor-private history remains available and amounts/totals are retained. Four Mongo/HTTP snapshot/boundary tests and API type/lint pass. Staff queue is not yet implemented; existing projection fixtures and full live verification still require reconciliation. See `docs/compliance/DONATION_CONTENT_REVIEW.md`.

- Campaign donor staff review implemented: exact-version private queue, transactional current-staff checks/audit, self-review and closed/restricted-donor protections, revocation on erasure, admin queue/exports and action-center link. Eight API and eight admin tests plus API/admin type-check and API lint pass. Campaign-specific adversarial/projection/browser/feedback coverage remains; see `docs/compliance/DONATION_CONTENT_REVIEW.md`.

- Campaign donor review lifecycle verified: self-review, restricted/erased donors and demoted staff denied; audit rollback and one-winner concurrent decisions preserve funds. Safety removal requeues remaining names without restoring removed messages. Initial five lifecycle/report tests and final three campaign lifecycle tests pass; API type/lint pass. Projection regression reconciliation and donor terms/feedback are next.

- Campaign donation live/projection regression: 27 tests pass across guest feeds, real wallet/live sessions and HTTP SSE. Unreviewed attribution stays hidden while totals update; approved snapshots honor blocks/privacy, and replay after a content edit cannot reveal buffered text. Existing event-bus expectation reconciled to admission policy. Next: donor name-only terms and fiat/crypto review feedback.

- Current verification: stable full API baseline passes 123 files / 836 tests before the campaign public-read correction. No API/shared source changed during that invocation. Subsequent slices have focused evidence and still require the final release sweep.

- Campaign public-read correction implemented: only active/funded/expired campaigns appear publicly. Owner/admin review access is preserved; private records are excluded before public pagination/counts and from share previews, organization projections, related feeds and live reads. Web/native viewer-scoped caches and public share/checkout state clear on denied refreshes. Campaign records and finances are retained. Final focused API/live checks pass 21 tests; full web passes 129, native passes 45, two phone share/checkout browser flows pass, and types/lint/build/export pass. Evidence and limits are recorded in `docs/compliance/CAMPAIGN_VISIBILITY.md`.

- Creator supporter visibility: current restricted/closed/blocked linked supporters are excluded without changing tip records or creator financial totals. Creator eligibility is enforced in the use case. Web/native scoped refreshes clear denied identity while preserving in-progress tip drafts. Thirteen API, four web and 62 native tests, type/lint, builds/exports and phone report/block plus supporter refresh flows pass; final screenshot inspected. Attribution admission remains open. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- Realtime/overlay donor identity: SSE live/replay rebuilds current donation data using a field allowlist and campaign ownership check, suppresses restricted/closed/blocked donors, and retains host privacy toggles. Overlay snapshots match the policy. Host names load through authenticated REST; optional campaign SSE URL corrected, global stays polling. Nineteen API and eleven web tests pass; final five route/live-identity tests and web type/lint/build pass. See `docs/compliance/REALTIME_IDENTITY.md`.

- Donation REST identity: anonymous recent gifts no longer expose donor account IDs. Restricted/closed/blocked donor names/photos/messages are redacted while donation rows, amounts, counts and private history remain. Web feed identities now come only from viewer-scoped REST refreshes; live events trigger re-fetch instead of restoring raw names. Twelve API and nine web tests, type/lint and web build pass; phone identity-redaction/amount-preservation verification passes (screenshot inspected). Live event/overlay and creator-supporter projections remain open. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- Leaderboard privacy: honors opt-outs and current closed/restricted/blocked identity before rankings, featured limits and totals; excludes anonymous gifts before grouping and unpublished-campaign/non-GHS donations. Account/financial records remain intact. API eight tests, web five hook tests, native 62 tests, type/lint and native exports pass. Final phone zero-total/console check and web rebuild pass after correcting empty-state HTML; screenshot inspected. Evidence: `docs/compliance/LEADERBOARD_PRIVACY.md`.

- Restricted contribution authors: comment/update reads now suppress restricted, closed and viewer-blocked authors while preserving separately published contributions when only the profile page is private. Source records/funds remain intact. Web/native scoped refreshes clear denied results and guard pre-block response races. Fifteen API and six web tests, 62 native tests, type/lint, web build and native exports pass; the final four-test awaited race rerun and phone refresh flow pass (screenshot inspected). Other public identity projections remain open. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- Organization and restricted-profile reads: one visibility adapter now hides private/restricted/closed/blocked identities from member profiles and organization list/slug/ID/campaign endpoints. Login email is removed from public organization DTOs. Web/native scoped refreshes clear denied identity; web SEO metadata is removed. Twenty-two API tests, API/web/native type/lint and two phone browser flows pass (screenshot inspected). Native baseline passes 59 tests plus three new hook tests; web production build and native all-platform exports pass. Embedded identity projections remain open. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- Public member-profile access: optional viewer authentication now enforces bilateral blocks; private/closed profiles and malformed IDs remain unavailable, and responses including denials are noncacheable. Web/native hooks isolate viewer/target changes and clear identity on denied refreshes. Seventeen API tests and API type/lint pass; five web hook/privacy tests, web/native type/lint and the web build pass. Final native iOS/Android/web export passes, including resetting stale profile navigation titles. Broader identity projections and restricted-account reads remain open. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- Alert close-button contrast corrected in the shared MUI theme: transparent actions inherit the alert foreground, retain visible keyboard focus and avoid pale raised-button surfaces. UI type/lint and the Settings phone flow pass; success/error screenshots inspected.

- Current: admin exports are complete. Campaign creation and vanity URL admission are implemented and verified. Staff campaign decisions and durable live-stop handling are verified. Creator profile admission is implemented and verified. Organization name/website admission and deletion lifecycle checks are verified. General profile atomic patches and web Settings ordering/failure recovery are verified. Account identity admission and final focused UI/artifact verification are complete. Next: initial registration/legacy identity and public projections, payment/live admission and remaining compliance operational requirements. The user explicitly prioritized finishing the public-read correction first. Compliance remains active; commit and main push remain pending.

- Account identity admission implemented: full public identity/visibility review excludes private contact/biography data, compares the original identity revision at final transaction, and leaves profile hiding/private settings available. Private biography is removed from user-report evidence. Web/native/admin forms retain held drafts with review feedback; Settings rolls publication holds back to private. Initial 20 API tests and final 11 account/image/closure tests pass; The dedicated final admission suite passes eight tests. API type/lint, final 15 web/nine admin checks and two phone flows pass. Private-contact UI omission, web/admin builds and native all-platform exports pass; screenshots inspected. Native profile runtime remains a device gate. See `docs/compliance/ACCOUNT_PUBLICATION.md`.

- General profile persistence prerequisite implemented: atomic field-only account/settings patches preserve concurrent privacy/contact/notification choices and omitted values, reject stale/closed sessions, and roll back on failure. Stale general user saves no longer restore old identity. API regression passes 27 tests with stable sources; API type/lint pass. Web Settings now orders field-only writes, isolates account state and restores server-confirmed values after failed optimistic saves; web type/lint/build, all 137 web tests and the mocked 390px ordering/rollback flow pass; screenshot inspected. Actual general-profile publication admission remains next. See `docs/compliance/ACCOUNT_PROFILE_WRITES.md`.

- Organization identity admission implemented: private owner/admin name-and-website review, exact actor/resource/base-version decisions and transactional credential/membership/identity/audit checks. Stale generic account saves cannot overwrite reviewed identity. Web drafts/consent are scoped to account/workspace; native owners have a separate reviewed identity editor. Initial nine organization API tests, 12 account regressions, ten web/four admin tests and the 390px hold/refresh/resubmit/workspace-consent flow pass; screenshot inspected. Closure now removes teammate-owned organization drafts and review insertion fences closed accounts; final 31-test publication/erasure regression passes with API/shared sources frozen. API/web/admin/native type/lint, web/admin builds, 59 native tests and all-platform native exports pass. Native physical-device interaction remains a release gate. See `docs/compliance/ORGANIZATION_IDENTITY.md`.

- Creator-page admission: complete merged versions now stay private until admitted, omitted settings are preserved, stored-revision and credential checks fence final transactional saves, and reviewed creator images no longer follow account-photo edits automatically. Exact Pause tips remains available despite an expired plan, publishing restriction or stale agreement and retains draft fields/balances. Real-admission, tip and withdrawal suites pass 22 tests; API type/lint and 59 native tests pass. Web/admin/native type/lint, production builds and all-platform native export pass. Three admin review tests and the phone hold/pause/refresh/resubmit flow pass; screenshot inspected. Web broad run passes 133 tests with one live readiness timeout; the final 13-test focused rerun passes without changing that live test. See `docs/compliance/CREATOR_PUBLICATION.md`.

- Staff campaign decision controls implemented: current-admin detail fingerprints the full reviewed record; approval/rejection/block/return-to-review save exact-version evidence, notes, reviewer identity and audit atomically. Required content/fundraising attestations, current-role/credential fencing, self-review denial, private reopening, funded-status preservation and stale-content conflicts protect the workflow. Duplicate content snapshots are removed on account closure while decisions/financial references remain. The admin page shows all reviewed fields, real history and branded history exports; nonexistent Edit/Delete controls were removed and the broken Unblock action was replaced by Return to review. Initial 24 API regressions, final seven staff-review tests, 55 admin tests, affected type/lint/build and the 390px conflict/reload/approval flow pass; screenshot inspected. Blocking queues live provider shutdown transactionally; audit rollback and provider-failure recovery tests pass. See `docs/compliance/CAMPAIGN_STAFF_REVIEW.md`.

- Campaign publication admission implemented: complete title/story/beneficiaries/goal/end-date/media proposals remain private until cleared; optional automated screening is unchecked, and the web/native wizard exposes review decisions without discarding the draft. Current plan/verification evidence is rechecked before the independent high-goal rule. Vanity URL changes use actor/campaign/prior-slug-bound review and atomic slug-only writes, preserving concurrent funds/status and refusing stale changes or revoked staff access. Verification: 34 campaign/publication/policy API regressions, final 13 campaign/unit tests, four web/two admin review tests, 59 native tests, phone hold/refresh/exact-resubmit flow, types/lint/web build and final all-platform native export pass. Full web run had 131 passes and one outdated copy assertion, corrected in the four-test rerun. Final screenshot inspected; updated privacy copy is in release bundles. Staff decision coverage is recorded separately below; see `docs/compliance/PUBLICATION_REVIEWS.md`.

- Optional authenticator MFA implemented across API/web/admin/native: explicit post-login setup, branded QR/manual key, six separate OTP boxes, one-use recovery codes with copy/download, durable attempts/replay prevention and transactional session revocation/audit. API 13 tests, full web/admin 132/39, native 47, types/lint and builds/export pass. Two phone browser flows pass, including exact clipboard/download content and the sign-in factor gate; final screenshots inspected. Native biometric session protection is implemented with 59 passing native tests, privacy-cover/navigation checks and types/lint. CocoaPods and ad-hoc signed simulator compilation pass; isolated runtime checks pass for opt-in, lock, unlock, background/resume and password fallback. Physical-device evidence remains pending; see `docs/compliance/MFA_AND_BIOMETRICS.md`.

- Admin PDF/XLSX/CSV exports implemented across data/report/detail/content pages and persisted settings. Shared controls preserve active filters and all server pages, cancel pending work on account/route changes and recheck current staff access before collection/download. New private admin donation reads and subscription pagination remove public-feed/50/500-row truncation. PDF embeds licensed Outfit fonts, current chain logo, forest/gold branding, watermark, repeated headers and page numbers; long-cell overflow was found in browser downloads, corrected and visually rechecked. Verification: 35 focused API/visibility/plan tests, 51 admin tests, two real browser download/permission flows, types/lint/build, multi-page extraction/render inspection and six dependency checks. Isolated clean install and all six dependency checks pass. Empty and wide-record PDFs were visually verified; the trailing blank-page issue is corrected. Coverage: `docs/compliance/ADMIN_EXPORTS.md`. Commit/main push remain pending with the broader compliance goal.

- Preventive comment/update admission: exact actor/resource/version checks now gate public persistence, including organization-team updates. Opted-in text uses OpenAI moderation; no consent, flags, provider failure and media go to private staff review. Author Settings, admin decision queue/action-center counts, audited immutable decisions, seven-day approvals and 30-day proposal retention implemented. Ten real-admission/provider/lifecycle API tests, full web/admin/marketing suites (125/39/8), native 43 tests, types/lint, web/admin builds, native export and 390px hold/resubmit flow pass. See `docs/compliance/PUBLICATION_REVIEWS.md`. The subsequent stable full API run passed 123 files / 836 tests. Campaign/profile/payment/live/media admission and operational evidence remain open.

- Comment privacy: nonpublic campaign discussion reads are owner/admin-only; outsiders cannot post into private campaigns. Web/native clear viewer-specific state immediately on account/campaign changes. Fourteen API safety/privacy/block/agreement tests and two web block/logout tests pass, with affected type/lint checks. Preventive screening remains open.

- Campaign-update safety: web/native item reports preserve private title/content/media evidence and a full-version digest. Admin hide/restrict decisions atomically fence the reviewed version, keep a retryable immutable action, and retain campaign finances; stale edits require a new review. Nonpublic updates are owner/admin-only, blocked-author reads are filtered, and viewer-scoped UI caches clear on account changes. Organization-team public writes now enforce agreement/restriction checks, including mixed-case routes. Eleven API tests, a corrected case-sensitive-ID regression rerun (7 tests), six web report/cache tests, two admin tests, native 43 tests, affected type/lint checks, builds/export and the 390px report browser flow pass. Preventive screening remains open.

- Publication audit: rechecked Apple/Google UGC requirements and traced campaign, comment/update, profile, payment-attribution, media and live write paths. `docs/compliance/PUBLICATION_SCREENING_AUDIT.md` identifies unscreened publication, effective-edit review and guest public-name consent gaps; AI-writing checks and the GHS 250k rule do not close them. The stable full API run subsequently completed with 822 passes; no API source changed during that run.

- Identity age validation: API rejects supplied underage/invalid dates; staff approval of identity records now requires a valid adult date before approval or verification-level changes. Web/native use the same calendar-date check and picker boundary. Eight API/domain/private-document tests pass, including legacy missing/underage records and leap dates. Optional omitted documents no longer crash ownership validation. See `docs/compliance/AGE_VERIFICATION.md` for remaining identity/provider/legacy gates.
- Staff-access audit correction: production currently has a single full-access admin role, with static `/rbac/me` permissions and a display-only roles page. Read-only admin states in UI fixtures are not configurable accounts. `docs/compliance/STAFF_ACCESS.md` records current authoritative role enforcement and conditional restricted-staff delegation requirements; no production permissions were changed.

- Refund funds holds: new operations atomically remove refundable campaign/recorded beneficiary net from payout-eligible pending balances before the provider call. Unknown/pending/failed responses retain holds; verified transactional completion consumes them once, and rollback retains them. A payout winning the initial-read race prevents provider submission. Web/native cashout explanations show refund holds separately; admin distinguishes legacy operations without holds. Thirty-one API/use-case tests, five admin/eight web tests, four-app type checks and API/admin lint pass. This supersedes the new-operation funds-hold gap below; legacy exposure, remaining payout lifecycle, failed-case disposition and donor case linkage remain open in `docs/compliance/REFUND_RECOVERY.md`.

- Beneficiary payout request correction: campaign and beneficiary clearing plus the payout request now commit atomically. Campaign shortfall or request-save failure leaves both balances unchanged; fresh-instance retry and concurrent requests preserve matching balances. Twenty-four beneficiary/split/refund integration tests and API type/lint pass. This closes the request mirror gap below; refund funds holds and other payout lifecycle boundaries remain open.

- Refund recovery: durable operation + donation reservation commit before the provider call; uncertain outcomes block replacement submissions. Read-only provider evidence must match operation/payment/amount/currency before transactional projection/journal/status completion. Admin recovery queue, verification, local-only retry and action-center count implemented. Thirty API tests, five admin tests, API/admin type/lint, admin build and mocked desktop/390px flows pass; screenshots inspected. `docs/compliance/REFUND_RECOVERY.md` records the remaining payout-coordinated funds hold, beneficiary mirror transaction, case linkage, granular backend permission and legacy reconciliation gates. No real refund or compliance push performed.

- Refund execution guard: always send the explicit campaign amount so a separate platform tip cannot be returned without corresponding accounting. Reject malformed amounts and cross-currency execution before provider calls/reservation; preserve original journals. Ten refund/intake tests and API type/lint pass. Durable provider outcome/recovery and case linkage remain open in `docs/compliance/REFUNDS_AND_FEES.md`.

- Diagnostic privacy: route-template request logs, query/userinfo stripping, restricted error serialization and sensitive-field removal prevent the observed token/provider-payload leakage. Three emitted-JSON/middleware regressions plus auth/Paystack tests pass (18 total); API type/lint checks pass. Historical logs and retention need operator review. See `docs/compliance/LOGGING_PRIVACY.md`.

- Dependency/store follow-up: patched vulnerable tooling and native parser chains, pinned npm 12.0.2 for reproducible workspace overrides, and added install-time patches plus five consumer security checks. Stable full audit: nine entries tied to two locally patched chains, none critical; upstream fixes remain tracked. Eighteen build/type/lint tasks and web/admin/marketing/native suites (118/32/8/42) pass; all-platform export passes. Full API returned 796 passes and three missing-consent fixture failures; corrected files plus consent regressions pass 16 tests. Final isolated clean install and five security checks pass; Expo Doctor 20/20 and final native type/lint/tests/export pass. Store submission checklist and source-based data inventory reconciled; see `docs/compliance/DEPENDENCY_SECURITY.md` and `STORE_DATA_INVENTORY.md`.

- User-specified campaign approval: goals above GHS 250,000 require staff unless the organizer has current approved identity/business verification and an earlier published campaign. Pending/draft/blocked history and stale or expired verification do not unlock the exception. Generic tier settings cannot waive the high-goal gate; lower goals retain tier policy. Fifteen focused tests pass, with real API/KYC wiring and retained compliance/plan caps. Admin/web/native/shared-terms copy updated. See `docs/compliance/CAMPAIGN_APPROVAL.md`; this remains separate from broader preventive content moderation.

- AI safety: the real writing adapter now screens requests before generation and drafts before return, withholds flagged content, and fails closed on screening errors. Web/native/Privacy Notice disclose this processing; raw text is not added to usage logs. Twenty-one API/service/adapter tests pass with provider doubles. Web/native previews now support in-app reporting of the original suggestion, with requester/fingerprint checks, private evidence and audited admin resolution. Fourteen reporting/AI/message API tests, nine web tests, a phone campaign-wizard report flow (screenshot inspected), affected type/lint checks and all-platform native export pass. `docs/compliance/AI_SAFETY.md` records remaining staff feedback/response, evidence retention, broader preventive UGC screening and provider/language/processor evidence.

- Refund/fee accuracy: new refund requests are free and record the full amount as pending; historical fee snapshots are retained. Web/native copy no longer promises 2% deductions or 5–7 days, and shared policy no longer claims automatic all-or-nothing refunds or draft recommended prices. Eight API tests, a phone browser flow and affected type/lint checks pass. See `docs/compliance/REFUNDS_AND_FEES.md` for remaining provider recovery, optional-tip accounting, case lifecycle, currency-specific fee and legal evidence work. No refund, production financial rewrite or compliance push performed.

- User priority: finish opt-in activity alerts/emails, then continue compliance, and commit/push verified work to main when done. Separate default-off category/channel preferences, durable financial-event capture and delivery, consent rechecks, inbox links and Resend retries are implemented; verification remains in progress. Account closure preserves the user ID and financial references while removing/anonymizing operational personal data. Focused closure/alert regression: 13 tests pass, including retained donation amount/wallet balance and suppression after an email-address change. See `docs/compliance/ACTIVITY_ALERTS.md`.
- Activity follow-up: 13 activity integration tests now cover every category, concurrent first-time choices, source-recovery and delivery boundaries; two sender tests, three erasure tests, four web Settings tests and 42 mobile tests pass. The mocked 390px Settings flow and all-platform JavaScript export pass; screenshot inspected. API/web/mobile type checks pass. Shared privacy copy now describes the choices and email provider. Returning to remaining compliance engineering, starting with persisted credential/session versioning across API instances.
- Session security: password changes/resets now persist a credential version checked by authenticated, optional-auth and refresh paths. Generic stale account saves no longer restore password hashes; competing password writes compare the original hash. Reset-token consumption and credential change commit in one transaction. Seven authentication/closure tests pass, including a fresh API instance and simultaneous resets; API type check passes. Recovery-email delivery remains open: the older forgot-password flow still logs a reset link rather than delivering mail and must be replaced before release.
- Recovery follow-up: removed reset-link logging, added encrypted short-lived delivery queue with stable retries and account/version checks, and implemented the public reset form. Recovery outages are visible on web/mobile; per-account cooldown and request timing padding added. Five API and three web component tests plus the 390px browser flow pass at the first checkpoint. `docs/compliance/ACCOUNT_EMAILS.md` tracks deployment and unfinished verification-email/security-notice work.
- Verification infrastructure: the unsigned iOS simulator build succeeded. The broad API run returned 750 passes/6 failures, but concurrent invocation cleanup was deleting other runs' test databases, and the run also overlapped source/test edits, so it cannot verify a stable snapshot. Cleanup now uses a separate random namespace per invocation and requires a dedicated `-test` database. The affected alert/auth/payout/recovery suites are rerunning against stable sources; do not treat the earlier full run as release evidence.
- Recovery/isolation verification: the affected four API suites pass 39 tests, followed by six recovery tests including simultaneous per-account cooldown. Three reset-form component tests, a 390px browser flow and API/web/mobile lint pass. API/web/mobile type checks pass. Email verification remains the next engineering task; production sender/key configuration and live delivery are not yet verified.
- Account-mail completion follow-up: verification request/confirmation and password-change security notices now use the encrypted queue. Web/native Settings request a link and refresh eligibility; verification changes no notification choices, roles or KYC levels. Stale profile saves cannot undo verification or restore an administrator role. Nineteen API tests, ten web component tests, the phone verification-to-opt-in browser flow, 42 mobile tests, type/lint checks and all-platform export pass. Screenshot inspected. Real sender/physical-device evidence remains external. Next engineering gap: newsletter confirmation/unsubscribe and its disconnected Settings marketing toggle.
- Newsletter follow-up: footer/blog use explicit unchecked consent; web/native Settings share pending/confirmed/withdrawn state. Confirmation and unsubscribe use purpose-bound hashed links, encrypted delivery, transactionally recorded consent and queued-message suppression. Legacy addresses are excluded from the admin mailing list. Eight API, seven component and one phone browser tests pass; screenshot inspected; five-app type/lint checks pass. Provider delivery, future bulk-mail tooling and retention remain release gates in `docs/compliance/NEWSLETTER.md`. Continuing with push consent.
- Unsupported-channel audit: removed misleading push/SMS/campaign-announcement switches and native push permission requests. New push registration is unavailable and stores no device identifier; legacy unregister remains authenticated and usable. Two API tests, API/web/native type/lint checks and the refreshed phone Settings/newsletter flow pass. Native newsletter regression passes 42 tests and all-platform export. See `docs/compliance/PUSH_NOTIFICATIONS.md` for the evidence and future delivery requirements.
- Data-rights follow-up: web/native request, history and response controls now cover access, correction and privacy complaints. Admin queue/action counts, fixed response target, immutable private evidence and concurrent-review fencing are implemented. Download/share covers the request and reviewed response, not an automatic collection dump. Closed-account external responses require an identity/delivery evidence reference. Six API, four component and the phone JSON-download flow pass; screenshot inspected; native 42 tests and export pass. `docs/compliance/DATA_RIGHTS.md` maps access sources and remaining retention/operator gates.
- Guest-message agreement: web donation/creator and native campaign checkout now capture unchecked content terms/18+ acknowledgement for nonempty public messages, including crypto. Services reject before payment creation and persist server-stamped agreement with the intent/tip. Seventeen payment regressions pass, followed by six crypto tests asserting persistence; phone consent flow, API/web/native types/lint, 42 native tests and export pass. Corrected unsupported always-email-receipt checkout copy. Reporting, preventive review and optional-auth restrictions remain open in `docs/compliance/CONTENT_MESSAGES.md`.
- Initial-message restriction follow-up: optional auth enforces current moderation restrictions on fiat, creator and crypto checkout messages; crypto routes now participate. Repository failures no longer downgrade a known account to guest processing. Five message/session tests and API type/lint pass; message-free checkout/profile access remain usable. Projection audit found donation messages also stored in outbox payloads and creator recent-tip responses missing reportable item IDs; the next moderation slice must handle these explicitly.
- Donor/supporter moderation: item-specific report controls, private snapshots and audited hide actions now cover web/native campaign history and creator supporters. Guest identities are not inferred; hiding preserves money/totals and prevents owner re-posting in the same donation slot. Outbox and SSE replay recheck current text/anonymity. Six safety/message tests, four SSE tests, two restriction tests, three report UI tests, one admin UI test and phone flow pass; screenshot inspected. Four-app types/lint, native 42 tests and export pass. Preventive moderation and broader live-client/anonymous-blocking coverage remain open.
- User requested an end-to-end compliance implementation goal and reiterated committing/pushing the completed work to main. Active requirements/evidence ledger: `docs/compliance/READINESS.md`.
- Current-source research covers Ghana data protection, electronic transactions, crowdfunding, AML, virtual assets and tax, plus Apple/Google payment, UGC, privacy/deletion and release requirements.
- Initial gaps include missing versioned policy acceptance, soft-delete-only personal-data handling, external native subscription checkout, unverified native fundraising permissions, and legal-operator identity inconsistency.
- Owner evidence requested for registrations/approvals, legal operator and launch countries. No legal certification, regulatory approval or store acceptance claimed.
- Native digital billing now uses Expo IAP with server verification, encrypted ownership records, transactional entitlements, durable notification/acknowledgement recovery, restore and store management. Paystack settlement is transactional with failure/restart tests; web/store overlap is blocked. Full API: 107 files / 743 tests pass; mobile: 36 tests; web store-management regression passes; all-platform JavaScript export passes. See `docs/compliance/STORE_BILLING.md` for configuration, remaining operator/rollout work and external purchase evidence. Compliance work remains uncommitted pending completion and final verification; the requested main push remains required.
- Fundraising follow-up: iOS campaign collection moves entirely into the external browser, including wallet/crypto choices; native creator tipping is unavailable pending a supported store payment model. No external creator payment link replaces it. Public profiles/balances remain accessible. Mobile suite now passes 42 tests; type/lint checks pass. See `docs/compliance/FUNDRAISING.md` for policy rationale and remaining device/owner evidence.
- Store billing recovery now has a sanitized admin queue, action-center counts and audited retry scheduling. Retries retain review flags and worker leases and cannot grant access or transfer ownership. Seven API/admin-action regression tests and API/admin type/lint checks pass; two operator UI tests pass. Follow-up stale-failure fencing passes 23 billing ownership/API tests.
- Website-contact consent: mobile signup now includes the optional website field/unchecked request, and web/native notices allow withdrawal. New requests/withdrawals are server-timestamped; stale account saves cannot restore withdrawn consent. Shared privacy copy identifies the recipient and purpose. Seven API and six web tests plus API/web/native type/lint checks pass; original request dates were not fabricated for legacy accounts.
- Implemented initial privacy controls: versioned policy/age acceptance, public deletion resource, persisted account closure and retryable core erasure with admin review queue, authenticated KYC uploads and audited expiring access, per-request OpenAI permission. API/web/admin/native type checks and focused tests pass; full API/web/admin/mobile suites pass (673/91/27/26 tests). Discussion and creator blocking/reporting now have persistent API enforcement, web/native controls, Settings unblock lists and an admin safety review/appeal queue. Focused API and UI suites plus a 390px browser flow pass. Live-session safety now includes guards, stable viewer identities, provider revocation/stop, durable retries, deletion cleanup and moderator retry consistency. Provider-backed rollout checks, guest-message safety and other release requirements remain open. Legacy media migration, processor retention, UGC safety and native store billing remain active requirements.

### 2026-09-12 — Organization website requests

- Organization web signup shows an optional, unchecked “Does your organization need a website?” checkbox while Website is blank. Entering a URL clears the selection; the accompanying copy identifies Neurodyne Corp Ltd as the contact company.
- Saved `needsWebsite` on the account, retained through repository updates and registration/login responses. Server only records true for an explicit organization opt-in with no website. Admin account details show the request for follow-up.
- Signed-in organizations with a saved request see a notice that parent company Neurodyne Corp Ltd will contact them, with links to https://neurodyne.dev and mailto:info@neurodyne.dev.
- Validation: 6 API integration and 9 web component tests pass; API/web/admin type checks, focused lint, web production build and diff checks pass. Existing build chunk-size advisory remains. No production deployment or external contact was performed; native mobile UI and browser visual acceptance are outside this change.

### 2026-09-12 — Campaign-style team photo uploads

- Replaced About-page team Photo URL fields with the shared campaign ImageUpload component: file selection/drag-drop, progress, square portrait preview, replace/remove and 4 MB limit. Authenticated admin uploads use the existing API profiles upload endpoint.
- CMS save retains the resulting member image alongside existing biography/social links. Team actions and saving are disabled during uploads to avoid reordering or saving an incomplete upload.
- Validation: admin type check, focused lint and diff checks pass. Mocked mobile browser verified authenticated image upload, preview, CMS save with existing social links retained, and image removal. No real file uploaded or About content published.

### 2026-09-12 — Planned social profiles prefilled

- User confirmed the social placeholder URLs are the profiles they intend to create. Admin Contact Details now fills blank social fields with those exact Ujimora URLs after loading, preserves existing URLs and leaves edits/clearing available. The normal CMS save publishes the values; no production content was saved in this change.

### 2026-09-12 — Contact content wiring and empty social sections

- Live read-only CMS check found all five social URLs blank while address and phone were populated. Contact sidebar ignored the address and rendered an empty social card; response rows were hardcoded launch copy. Footer separately used hardcoded profile URLs.
- Sidebar now shows saved address/phone, provides direct email contact when socials are absent, and renders configured social links with labels/icons. Footer reads the same contact CMS social fields. Support availability replaces placeholder response rows until estimates are configured.
- Admin Contact Details now explains social publication and provides optional response-time fields. No social URLs or timing promises were invented or saved to production; official URLs/estimates requested from the user.
- Validation: admin/marketing type checks and focused lint; mocked browser verified empty/partial social data, saved address/phone, configured social links/response estimates and no overflow at 390px. Inspected mobile screenshot. Live CMS was read only.

### 2026-09-12 — Dedicated coupon creation wizard

- New Coupon opens `/coupons/new`, guarded by coupon CREATE permission. Four branded steps cover Offer, Eligibility, Limits & schedule, and Review; phone layouts stack vertically.
- Extracted shared coupon fields/model to preserve existing edit options. Creation retains discount caps, surfaces, plans/cycles, commission basis, recipient rules, limits, dates and active state. Review exposes every configured value before POST; failed saves retain input and successful saves return to the list with confirmation.
- Validation: admin type check, focused lint, production build and three model tests pass (existing bundle-size advisory remains). Mocked browser verified required-code validation, back-navigation retention, no pre-review submission, duplicate-code error/retry, normalized payload, list confirmation, CREATE permission denial and no overflow at 390px. Inspected mobile review screenshot. No real coupon created.

### 2026-09-12 — Testimonial dialog brand colors

- Removed hardcoded purple create/edit/delete dialog backgrounds, faded white labels and orange create-button hover. Dialogs now consume active brand surface/text/material tokens; rating uses brand gold and the save button uses theme states.
- Added a quote icon and explanatory heading, mobile field stacking and wrapping avatar choices with accessible selection buttons/checkmarks.
- Validation: admin type check, focused ESLint and diff checks pass. Mocked local browser verified dark/light dialog colors, mobile/desktop dialog bounds at 390/1280px, avatar selection and themed enabled-button hover; inspected dark desktop screenshot. No testimonial was saved or published.

### 2026-09-12 — Branded collaborator invitation choices

- Replaced the native collaborator-role select with vertically stacked, appearance-aware radio cards. Each role has an icon, title and description, with selected depth/outline and keyboard focus treatment.
- Added a branded invitation heading icon and description; narrowed mobile dialog margins and stacked the campaign collaborator heading/action on phones.
- Validation: web type check, focused lint and diff checks pass. Mocked local browser confirmed role selection by click and arrow key, no native select in the dialog, and no dialog overflow at 320/390px; inspected the 390px screenshot. No invitation sent or production deployment performed.

### 2026-09-12 — Admin mobile campaign layout and navbar

- Shared admin header statistics stack on phones, use two columns on tablets and up to four on large screens. Shrinkable tracks and wrapping prevent long values from clipping; campaign header padding aligns with the content below.
- Campaign details now have a full-width organizer action, stacked labeled detail cards on mobile, separate readable start/end dates and an accessible funding progress bar. Loading placeholders are width-bounded.
- Mobile navbar uses an avatar-only account control, shorter accessible search field, bounded flexible sizing and a desktop-only separator/name/chevron.
- Validation: admin type check, focused ESLint and diff checks pass. Local browser with mocked API data verified no horizontal overflow at 320/390/768/1440px, single-column statistics/details on phones, account-menu opening and organizer navigation. Inspected the 320px screenshot. No production deployment performed.

### 2026-09-10 — Brighter dark text and appearance-aware signup choices

- Brightened shared dark primary/secondary/brand text and semantic dark variants, keeping light-mode colors and subtle border tokens unchanged. Password strength now uses semantic success/warning/error colors rather than a dark forest label.
- Account/plan/organization choices now use active-skin raised/inset surfaces, backdrop treatment and shape variables. Selected items retain their check/radio and subtle outline.
- Validation: four shared skin/contrast tests pass across all appearance finishes; registration flow tests pass. Local browser confirmed settled dark account text rgb(192,220,199) over rgb(32,41,31), and Strong password text rgb(141,201,161). Shared UI/web/admin/marketing type checks, focused lint and web build pass. No complete route-by-route visual audit claimed.

### 2026-09-10 — Organization identity and team workspace

- Profile/auth responses now retain organizationName separately from the contact name. Web profile/header prefer the organization name; the contact remains editable as Contact person, with a Managed by label.
- Added authenticated organization workspace and email-bound in-app invitations with seven-day expiry and verified-email acceptance. Owner can assign Administrator, Campaign Editor or Viewer, change roles and revoke access; administrators cannot grant or remove administrator access.
- Server checks organization membership for every workspace action. Administrators manage organization name/website and invitations; editors publish campaign updates with their own author identity; viewers are read-only. Existing payout/wallet authorization remains unchanged and no organization finance delegation is introduced.
- Entry: Profile → Organization workspace & team. Invitations are in-app, with a copyable workspace link; no invitation email is sent. Existing accounts and ownership are preserved.
- Validation: two API integration scenarios cover authentication, organization scoping, email verification, invitation replay/expiry, role changes, campaign-update authorship and revocation; six web tests cover profile identity and role-dependent controls. API/web type checks, focused web lint and web production build pass. Production visual acceptance and external email delivery are not claimed.

### 2026-09-10 — Real web profile fields

- Removed hardcoded sample bio and phone, and stopped forcing Ghana into profile saves. Load name, phone, bio, country and images from the authenticated profile endpoint; missing optional fields remain blank.
- Profile loading uses a skeleton; failed reads block editing and offer illustrated retry. Analytics failure no longer prevents profile details loading. Successful saves update the profile heading and authenticated name cache.
- Validation: three profile regression tests cover saved values, blank optional fields, save payload/name synchronization and failed-load recovery. Web type check, focused lint and build pass. Existing stored values were not rewritten or deleted.

### 2026-09-10 — Signup pricing and payment recovery

- Verified live public prices: Enterprise GHS 99.99 monthly / GHS 999 yearly. Signup previously requested authenticated `/plans`, then silently displayed outdated seeded prices. It now loads `/plans/public`, blocks checkout while prices are unavailable, and labels annual totals clearly.
- Checkout initialization failure preserves the created account and routes to subscription payment with the selected plan/yearly cycle and visible feedback. Failed checkout retries preserve the same selection. Added a latest-checkout verification link for users returning from payment; removed the unsupported claim that a failed payment means no debit.
- Validation: 8 web flow/pricing tests and 10 API verification tests pass (failed/abandoned payments never activate plans); web type check, focused lint and build pass. No payment initiated. Hosted cancellation visual behavior remains unverified.

### 2026-09-10 — Campaign recovery and shorter organization registration

- Fixed admin response unwrapping of `data: null`: a valid no-active-split response previously became an envelope object and crashed beneficiary rendering. Added guarded split data, separate error/retry state, and regression coverage.
- Campaign detail now uses appearance-aware surfaces and text instead of the purple background, a cover image, spaced content/actions, organizer navigation and shared payment-method donation cards. Added branded router error recovery with illustrated empty state, reload/dashboard actions and no public stack trace.
- Organization registration now has Account → Organization → Contact → Plan, preserving entered values and validating fields on their own step. Individual registration stays at three steps. Compact step labels support narrow screens.
- Validation: 8 admin regression tests and 2 registration flow tests pass; admin/web type checks and production builds pass. Build size warnings remain. Production visual acceptance is not yet verified.

### 2026-09-10 — Payout history cards

- Replaced compressed payout history text with appearance-aware cards: destination icon, friendly status chip, prominent net amount, status-specific guidance, requested amount/service fee/date and request reference. Added an oversized wallet watermark and responsive detail layout.
- Removed the repeated general status paragraph; each request now explains its own state. Amounts remain sourced from the recorded payout, with its own currency.
- Validation: web type check and eight money-flow tests pass. Inspected the pending card in an isolated 390px dark-mode browser preview. No payment behavior changed.

### 2026-09-10 — Illustrated notification empty states

- Replaced the plain empty inbox with the shared illustrated EmptyState, compact typography and inset appearance surface. Added oversized bell/chain watermarks to the panel and subtle icon watermarks to notification rows.
- Admin empty review queue now uses a compact completed-review card with a check watermark; pending action links use matching surfaces and arrow watermarks.
- Validation: web/admin type checks and two inbox behavior tests pass. Isolated mobile browser preview at 390px shows no horizontal overflow. No notification backend behavior changed.

### 2026-09-10 — Notification inboxes and payout review visibility

- Live read-only audit: Help Us Keep Our Digital Platform Running has GHS 5,200 raised and status funded; campaign, creator and beneficiary payout collections contain zero requests. Saved-account beneficiary review is distinct from a submitted cashout. No request was fabricated and no funds were transferred.
- Added a shared, responsive notification bell to web/admin with unread counts, inbox, mark-read/all-read, skeletons, retry feedback and 30-second/focus refresh. Dashboard notifications synchronize read state with the bell.
- Admin action-center endpoint counts actual pending campaign/beneficiary payouts, campaigns, identity checks, disputes and new contacts. Admin-only authentication protects counts; visible links honor frontend resource permissions. Bell links and sidebar badges lead to review queues and refresh after payout approvals/navigation.
- Spaced payout view controls using selected appearance surfaces and mobile wrapping; beneficiary links select the correct view. Empty queues now explain that saved accounts are not cashout requests. Account-save feedback directs owners to enter an amount and request cashout; successful submissions include the payout ID.
- Validation: ten web money/inbox tests and admin action-center integration pass (401/403 guards, pending request visibility, status/count reconciliation). API/web/admin type checks and web/admin builds pass using project TypeScript; existing bundle-size warnings remain. No production payout or native release performed. Live deployment acceptance remains separate from source/build checks.


### 2026-09-10 — Searchable banks, Telecel naming and subtle borders

- Replaced long bank selects with a reusable searchable autocomplete on saved accounts, campaign cashout and creator withdrawal. The dropdown has bounded height, keyboard selection and name filtering; provider codes remain the submitted value. Native selection already provides a searchable dialog.
- Normalized legacy Vodafone directory labels to Telecel Cash on the API and web, retaining VOD routing codes. Saved-account option labels use the same naming on web/native. Replaced plain plan/count text with a plan/capacity indicator, remaining slots, and unlimited/full states.
- Softened structural borders throughout the shared web/admin/marketing theme, including Box/card/paper/button/input/divider/table surfaces. Removed bright hardcoded campaign wizard/category outlines; selected borders use muted gold and keyboard focus keeps its separate outline. Preserved skin materials and card watermarks.
- Validation: 14 web flow/picker tests, 7 API bank/payout checks, all five app type checks, focused lint and web production build pass. Native source changes require a new build; no live account save or payout was initiated.

### 2026-09-10 — Smooth motion across the web app

- Added auth content staggering, finite watermark entrances and a chain-line draw on login/registration. Registration steps enter softly; focusing the form cancels decorative entrance motion. Preserved existing font, palette, materials, rounded controls and watermarks.
- Shared web motion covers route fades, account headings, visible campaign/payout cards, button press/hover feedback, alerts, tabs and progress changes. Theme durations align MUI menus/dialogs/collapses. Card reveals run once per mount with observer cleanup, no persistent hidden content and no extra animation dependency.
- OS reduced-motion preference disables CSS effects and sets MUI transition durations to zero; runtime card animations cancel on preference changes or focus. Existing donation celebration respects the same preference.
- Validation: web build/type check, focused lint, 14 motion/campaign-card tests pass. Browser preview was interrupted by concurrent user activity, so rendered auth motion has not been visually verified in this slice. Applies to mobile web; native and separate marketing app were not changed.

### 2026-09-10 — Explain and reconcile campaign payout calculations

- Audited campaign 6aa184c66d4e5ed850d9e640 against production donation records. GHS 4,200 in hosted gifts and GHS 1,000 in a legacy wallet gift explain GHS 5,200 raised. The wallet gift had debited the donor and incremented raised, but bypassed payout accounting. Redirected the legacy donation endpoint through donation-intent settlement and aligned wallet fees with the campaign creation-rate lock used by Paystack.
- Campaign rate is locked at 5%, created before the Pro upgrade (current admin-configured Pro rate 2%). Hosted processor fees total GHS 102.38 on GHS 5,250 checkout gross, including GHS 1,050 optional platform tips. No processing fee applies to the wallet gift.
- Added a dry-run-first, transactional repair script with matching wallet-debit evidence, exact raised-gap guard, balanced journal and repeat protection. Applied to wallet donation 6aa298931946784f2361eb26: GHS 1,000 gross, GHS 50 locked plan fee, GHS 950 net. Verified repeat is a no-op. Production eligible balance corrected from GHS 3,887.62 to GHS 4,837.62; raised stays GHS 5,200. No external transfer initiated.
- Web/native cashout now shows recorded raised/plan fees/processor fees/prior payouts/reserves/eligible balance, the campaign locked rate, discrepancy warnings, and a separate requested-amount/service-fee/net quote. Fixed non-standard service copy incorrectly claiming standard fees. Historical fees are not recalculated from today's plan or charged twice.
- Validation: 24 focused API tests, 8 web flow tests, and the real-Mongo repair test pass; API/web/mobile type checks and focused lint pass. Native source still needs a build; no native release claimed.

### 2026-09-10 — Wallet destinations and branded saved accounts

- Fixed saved payout account validation (358620f): embedded account `type` now has an explicit Mongoose field definition. Regression coverage validates bank and MoMo subdocuments.
- Campaign cashout and creator earnings can select Ujimora Wallet alongside bank/MoMo. Campaign wallet payouts retain admin review, dual approval, early fees and reserve rules. Creator wallet transfers retain live plan fees. Transactional wallet credits, source balances, history and balanced journals commit together; retry keys prevent duplicate credits and provider webhooks ignore internal payouts.
- Replaced plain saved accounts with provider-colored card faces, masked numbers, large lettering watermarks and curved detail. MTN yellow, Telecel red, AT blue and supported bank treatments share web/native branding. Review status and removal sit below the face. Browser inspection confirmed the saved MTN card and illustrated payout-history empty state. Manage saved accounts is a quieter link.
- Validation: 61 focused API tests (including real Mongo transaction/concurrency/rollback tests), 11 web flow tests and 24 mobile logic tests pass. API/web/admin/mobile type checks, focused lint and diff checks pass. No live funds were moved; native source requires a new build. Wallet earnings credit is implemented; external withdrawal of the wallet balance itself is outside this slice.

### 2026-09-10 — Cashout skeletons and organizer card

- Campaign cashout and campaign selection now use web/native skeletons instead of loading text. Initial cashout errors hide the skeleton; web retry clears the error. Five owner money-flow tests and web/native type checks pass. Pushed ba7e7fa.
- Redesigned campaign organizer as a compact, theme-aware card: larger portrait, name/location, separate verification row, date footer, gold detail and subtle person watermark. Removed stretch to match the taller checkout panel. Public identity data and verification semantics stay unchanged; loading retains skeletons. Local browser inspection, web type check and focused lint pass. Responsive spacing and text wrapping support mobile web.

### 2026-09-10 — Publish remaining campaign-card preview

- User requested commit and push after local preview. Published the remaining campaign-card redesign: larger media/title, category in the body, forest funding summary with gold progress, clear goal/remaining amount, supporter labels and View campaign footer.
- Eleven campaign-card tests, focused lint and diff checks pass. The final shared button radius is 9px (420de21), halved from the initial 18px at the user's request. Local documents, images and generated output remain untracked.

### 2026-09-10 — Uniform rounded buttons

- User requested the rounded rectangle button shape from their reference across all buttons. Added an 18px action radius and shared web/admin baseline so CTA, icon, toggle, raw HTML and menu buttons override legacy page-specific corner shapes without changing material, palette or input shapes.
- Native shared Button and rounded touch/icon/segmented controls now use 18px across screens, including animated actions. Preserved interaction props, pressed styles and accessibility. Native changes require a new binary.
- Web/admin/marketing/mobile type checks and targeted lint pass. Existing unpublished campaign-card preview is untouched.

### 2026-09-10 — Watermarks, payout skeletons and marketing facts

- Restored decorative icon watermarks in the compact account menu at the user's request. Saved-account loading now uses themed web/native skeletons; failures stop loading and offer retry. A regression test covers pending, failure and recovery; four focused web tests and web/mobile type checks pass.
- Replaced affiliate/organization hardcoded near-black stats strips and multicolor icons with shared MarketingFacts cards using current theme and material variables, subtle watermarks, gold accents, and responsive two/four-column layout. Marketing type check and focused lint pass.
- Payout accounts/plan controls/creator imagery release d1be581 deployed successfully to API, web and admin. Public creator response includes the existing profile portrait and cover. Watermark/skeleton follow-ups also deployed to web. Native updates still need a new binary.

### 2026-09-10 — Dedicated payout accounts, material-aware navigation and creator imagery

- Added authenticated /payout-accounts web/native pages and menu entries beside Settings. Users can save/remove multiple bank/MoMo destinations, see masked details and verification state, and select them for campaign or creator payouts. Campaign bindings remain immutable snapshots. Legacy account-entry paths also pass through the saved-account allowance in production.
- User confirmed defaults: Community 1, Plus 2, Pro 3, Organization 5, Enterprise unlimited. maxPayoutAccounts is editable for existing/custom plans in Admin → Plans; -1 means unlimited and 0 blocks new saves. Existing saved destinations remain usable on downgrade. Duplicate Ghana phone formats resolve to one saved account. Per-user document and atomic conditional append enforce the count under competing saves; owner-scoped lookup/remove prevents cross-account selection.
- Creator withdrawals reuse saved recipients; unresolved names cannot initiate creator transfers. Campaign payout ownership/capacity review and reservation safeguards remain enforced. No account was registered or transferred during testing.
- Replaced oversized account-menu tiles with compact two-column rows and material-aware controls (skin geometry, shadows, border and backdrop). Header and menu use the signed-in profile portrait. Public creator page uses public profile portrait/cover, preserving profile privacy; branded fallback stays available. Desktop support panel sits beside the profile, mobile stacks it; Custom amount focuses the editable amount on both clients. Profile-image editing stays in the existing profile editor.
- Validation: 50 focused API tests, 11 web flow tests and 24 native logic tests pass, plus API/web/admin/mobile type checks. Native source requires a new build; no native store release or real transfer is claimed. Prior campaign-card preview remains separate and unpublished.


### 2026-09-10 — Creator visibility and public support return flow

- Confirmed unauthenticated GET /creators/pontifex returns the public profile with tips enabled, GHS 10/25/50/100 presets and no private payout/balance fields. Shared creator pages are public routes; the owner dashboard remains authenticated.
- Fixed the dark-mode balance contrast and muted immutable handle, allowed shared links to wrap, added public-page preview and private/public explanations. Native owner view also gains preview/readable handle.
- Found and fixed missing /tip/callback route. New guest confirmation verifies stored reference/amount/currency with Paystack before existing idempotent tip settlement, handles pending/failure/retry, returns only public confirmation fields and celebrates only confirmed success. Tip intent is persisted with a full UUID reference before checkout initialization.
- Added anonymous-support controls and disclosure of public names/messages and private email on web/native support forms. Native browser return can verify and retry pending payment status without recharging. Native changes require a new build.
- Validation: 8 focused API tests, 5 web callback/dashboard checks, 24 existing mobile logic tests, API/web/mobile type checks and targeted lint pass. No live tip or withdrawal was initiated; real-provider settlement remains unexercised for this new creator callback.


### 2026-09-10 — Payout onboarding and recipient verification

- Added per-campaign payout account selection/setup to web and native Settings, and an expanded setup step immediately after campaign creation. Existing campaign-specific destinations remain explicit; split campaigns retain beneficiary setup.
- Account saving resolves the registered name through server-side Paystack account resolution. Name matches are labeled separately from ownership; mismatches, unsupported resolution, failures and legacy accounts require review. No wallet balance, remaining allowance or guaranteed transfer success is claimed.
- Admin approval loads the immutable payout destination and requires a beneficiary ownership/authorization and receiving-capacity review note. Reviews are persisted with admin, time and payout ID before approval/reservation; both maker-checker approvals are recorded. Legacy clients cannot approve without review.
- Added MoMo limit guidance, bank-account alternative, pending/failed/reversed recovery guidance, and blocked automatic batching of oversized MoMo payouts. No transfer, test charge or payout-account registration was initiated during verification.
- Validation: 32 focused API tests, 5 web money-flow tests, 24 mobile logic tests and all four application type checks pass. Native UI source still requires an updated app build; no device walkthrough or store release is claimed. Prior campaign-card preview remains unpublished.


### 2026-09-10 — Subscription recovery, early surcharge and mobile parity

- Fixed View plans wrapping on the creator dashboard. Added owner-authenticated subscription verification by checkout ID and by stored provider reference, validating amount/currency/reference before reusing settlement. New callback URLs include checkout IDs; old links no longer depend on browser storage or fall back to unrelated handoffs.
- Read-only Paystack verification confirmed reported sub-dee42508 succeeded for GHS 29.99, checkout 6aa28d2ae4fb273d0b77b020. After deployment of 0276cbf, the signed-in production callback confirmed “Your Pro plan is now active” and GH₵29.99 paid. Web/admin Vercel and Render API deployments succeeded; no new charge was initiated.
- Enforced the user's no-bypass rule at campaign payout request and approval: active under-goal campaigns require early/urgent cashout. Added the admin early percentage setting. Plan fees remain charged once at donation settlement; the payout surcharge is additional. Urgent fees cannot undercut the early surcharge.
- Mobile now verifies donation references, persists/resumes subscription checkouts, uses supported leaderboard periods and shows guest-inclusive totals, loads the real donations endpoint, displays owner notifications, supports campaign cashout management, and celebrates confirmed donations with reduced-motion-aware particles. Shared API guest feeds, notification delivery and transfer safety apply to both clients.
- Validation: 22 focused backend tests, 5 web checks and all 24 mobile logic tests pass; API/web/admin/mobile type checks and lint pass. iOS production JS export succeeded. Native source changes require an updated app build; no App Store/TestFlight release is claimed. Prior campaign-card redesign remains an unpublished preview.


### 2026-09-10 — Owner donation notifications and campaign cashout audit

- Wired settled gifts to a deduplicated owner inbox and optional Resend email, honoring email/campaign-update preferences and anonymous donor privacy. Added independent minute-based outbox retry and the web Dashboard inbox.
- Added owner-only payout options and a web campaign cashout panel with bank/MoMo recipient setup, configured fee preview, request submission and payout history. Request remains distinct from admin approval/transfer.
- Fixed ambiguous Paystack transfer errors releasing potentially sent funds on campaign/beneficiary/affiliate rails; single and batched reservations now remain held for reference-based reconciliation. Creator rail already preserved ambiguous attempts.
- Verified Resend's ujimora.com domain status and Paystack test balance through read-only provider calls. No money moved or historical emails sent. API runtime email variables and actual mailbox delivery still require deployment validation.
- 39 focused API tests and 3 owner-screen tests pass; API/web type-check, focused lint, and desktop/mobile mocked browser checks pass. See docs/paystack-owner-notifications-and-cashout.md for operational steps and the open standard/early-withdrawal policy decision. Prior card redesign remains a separate local preview.


### 2026-09-10 — Leaderboard guest aggregation and refresh repair

- Reproduced production leaderboard returning 400 Invalid ID format while stats reported two confirmed guest gifts totaling GHS 4,200. Filter invalid/sentinel IDs before Mongo user lookups in rankings and category stats; featured rankings use the same repaired repository.
- Guest amounts/counts remain in Everyone totals, but the shared guest sentinel no longer counts as one registered person. Existing individual/organization ranking eligibility remains unchanged. Historical guest gifts are not reassigned to accounts.
- Web now shows totals even when rankings are empty, explains guest eligibility, surfaces loading failures with Retry, and refreshes every 30 seconds and on focus/visibility return. Fixed a loading-timer race exposed by the hook tests.
- Validation: four repository regressions and three hook tests pass; API/web type checks and targeted lint pass. Browser checks verified GHS 4,200 with empty rankings and the failure/retry state. Existing unrelated CampaignLivePage CI failure remains outside this change.


### 2026-09-10 — Donation return celebration

- Confirmed donations now celebrate with gold/sage confetti and small heart particles following gravity, drag, spin and flutter, plus a damped-spring success medallion and warmer thank-you copy. A Celebrate again action replays decoration without calling payment verification or creating a charge.
- Motion mounts only after SUCCEEDED. Desktop uses 68 particles, mobile 44; bursts finish within about four seconds. Animations cancel and particles clear on unmount, hidden tabs, or switching to reduced motion. Reduced-motion users receive a static confirmation with no replay control.
- Four callback tests pass, including success-only particle mounting and replay not re-verifying payment. Web type-check, focused lint and production build pass. Browser checks confirmed desktop/mobile particle counts, zero particles with reduced motion (including on load), and automatic cleanup after completion. No new animation dependency.

### 2026-09-10 — Guest donation feed repair

- Reproduced the deployed campaign Donations tab returning `400 Invalid ID format` after a guest contribution settled. Its sentinel donor ID (`guest`) was passed to the MongoDB user lookup.
- Shared the existing guest ID constant with campaign/recent donation feeds, live overlay reads, and realtime projection. Guest entries skip account lookup and display Guest donor; anonymous entries retain their privacy behavior. Registered donor names/avatars still resolve normally. No donation amounts or settlement records are changed.
- Regression coverage exercises guest/anonymous campaign lists, registered donors, recent activity, overlay privacy, and realtime publication. All 27 focused tests (9 new feed tests plus 18 payment-verification regressions), API type-check, targeted ESLint and diff checks pass. Existing full CI has an unrelated CampaignLivePage test expecting a Go LIVE button; this change does not claim that full suite is green.

### 2026-09-10 — Hosted donation callback verification

- Fixed a confirmed test-payment incident: Paystack reported a successful GHS 250 charge (GHS 200 donation + GHS 50 tip), while the public intent remained PENDING. The callback only polled stored status, so a missed webhook could not recover during the return flow.
- Added rate-limited public `POST /donation-intents/:id/verify`, bound to the stored payment reference. It verifies with server-side provider credentials and reuses existing reconciliation and exactly-once settlement. Amount, currency, reference, fee validity, and terminal-state guards remain enforced; donor PII is excluded.
- Web callback requests verification on return and periodically during polling. An unmatched reference no longer falls back to a different last checkout. Timeout copy now describes the actual unconfirmed state and invites secure rechecking.
- Validation: 18 API tests (including real reconciliation/settlement use cases and guest HTTP routing), 4 callback component tests, API/web type checks, targeted ESLint, web production build, and diff checks passed.
- Published `4a96767`; Vercel web and Render API deployments succeeded. Production verification of the reported reference returned SUCCEEDED at 09:19 UTC, recovering the existing GHS 200 donation plus GHS 50 tip without creating another charge.
- CI's default npm version rejected the existing npm-11 workspace lockfile before reaching checks. Pinned CI to the repository's declared npm 11.12.1; a clean-install dry run with that exact version passes. No dependency versions or lockfile were changed.

> Active completion pass started: 2026-08-09
> Goal: production-complete web, mobile, API, marketing, admin, and organization experiences with App Store readiness, CMS-backed public content, soft deletion, and verified frontend/backend parity.

## Native chip and button material styling — 2026-09-09

- Shared chips now apply the active subtle surface recipe and material-specific corners while retaining semantic urgency colors. Shared buttons apply raised/inset recipes, selected material corners, readable foregrounds and pressed states; loading dots and accessibility state are preserved. Remaining direct Paper Button imports were migrated to the shared control.
- Verified campaign chips and Donate/Share surfaces in the running simulator. Mobile TypeScript, lint and 21 logic tests passed. Included in the mobile polish release.

## Native campaign actions and chip rendering — 2026-09-09

- Removed the Donate button’s extra bottom margin that stretched Share; both actions now have matching content height and rounded clipping, with normal spacing before the remaining-goal text.
- Audited mobile chips and custom badges. Replaced Paper informational chips across campaign details/cards/updates, beneficiaries, organization categories, public profiles and creator payout status with a shared text-sized component. Removed fixed 24/28px heights, normalized label spacing and allowed long labels to wrap. Custom padding-based badges did not have the fixed-height problem.
- Beneficiary chip visually checked in the signed-in simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Native input appearance correction — 2026-09-09

- Removed Paper’s default purple surfaceVariant from light/dark themes. Shared inputs now use the selected material’s inset recipe, rounded shape, brand text/icons and full focus/error border rather than the stock underline. Subscription coupon input also uses this component.
- Mobile TypeScript and lint passed; the simulator profile editor visibly renders warm inset fields instead of purple fills. Included in the mobile polish release.

## Native profile editor refinement — 2026-09-09

- Replaced separate image-upload cards with one appearance-aware cover/avatar/name preview matching the profile composition. Cover fills its frame; the profile photo is circular and overlaps the cover.
- Compact, labeled change/camera/remove controls retain existing upload, crop, error and save guards. Identity fields remain below in About you. Verified real images and controls in the signed-in iOS simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Native profile header refinement — 2026-09-09

- Joined the cover and avatar with a 52px overlap and theme-colored photo border; removed the duplicate safe-area gap, added a rounded cover and separate settings/header row, and linked Edit images directly to profile editing.
- Identity and statistics now use readable appearance colors. The cover edit control stays above the avatar on narrow screens. Verified the actual cover/profile photos in the signed-in iOS simulator; mobile TypeScript and lint passed. Included in the mobile polish release.

## Admin settings mobile table — 2026-09-09

- Fixed horizontal scrolling for the subscription-tier fee table, constrained it to the phone viewport, added a mobile swipe hint and keyboard-focusable named region. Read-only viewers can scroll the informational table.
- Verification: admin TypeScript, lint, 15 tests and production build passed. Chromium checks at 390px confirmed no page overflow, keyboard scrolling and the Price column fully reachable for editable and read-only roles (mocked API permissions).
- Published together with the accumulated native parity and shared legal-page work; physical-device/provider acceptance limitations remain recorded below.

## Active goal: native mobile feature and design parity — 2026-09-09

Owner: Codex. Status: engineering parity pass complete locally; physical-device/provider acceptance remains external. Scope: current web user-facing capabilities and native design equivalents, with provider/device acceptance tracked separately.

| Work | Status | Acceptance |
|---|---|---|
| KYC, uploads, address/GPS | ENGINEERING IMPLEMENTED | Actual entered data/uploads reach API; validation, retry and branded selection |
| Session refresh/inactivity | ENGINEERING IMPLEMENTED | Single-flight refresh, transient-error preservation, idle expiry, late-refresh guards |
| Payment checkout/crypto and wallet funding | ENGINEERING IMPLEMENTED | Real API contracts, idempotency, provider-confirmed status |
| Campaign creation, media, AI and management | ENGINEERING IMPLEMENTED | Live limits, upload/crop, preview/apply AI, validation |
| Profiles, organizations and creator flows | ENGINEERING IMPLEMENTED | Native image/cover editing, owner authorization, paid policy |
| Live host/viewer | ENGINEERING IMPLEMENTED | Native transport, permissions, recovery, donation attribution |
| Navigation, loading, skins and accessibility | ENGINEERING IMPLEMENTED | Matching destinations, skeletons/dots, branded surfaces/watermarks |
| Legal pages and policy collection | ENGINEERING IMPLEMENTED | Shared eight-policy source, native offline pages, web redesign/recovery; web browser and native simulator policy checks pass |
| Remaining routes and final verification | ENGINEERING VERIFIED; EXTERNAL ACCEPTANCE OPEN | Route/contract inventory, tests and native bundle/runtime review |

Current evidence: mobile TypeScript and lint pass; 21 native logic tests pass. iOS, Android and Expo web Metro exports pass. The ReplayKit broadcast extension compiles for the simulator. Web legal checks: 40 unit tests and three browser scenarios pass (all eight policies, phone layout/anchors, four skins in both modes). Full iOS simulator build and installation passed with ad-hoc signing. Public home loads real API data. Legal hub, all eight direct policy links, section jumps and light/dark reading layouts passed native walkthrough. Signed-in checks passed for profile, wallet funding entry, subscription selection/keyboard layout, KYC validation and nationality selection, paid creator restrictions, and owner live studio. Campaign creation correctly enforces the account’s full active-campaign allowance. All four appearances were checked; original preferences were restored. No provider transaction or live broadcast was initiated. Expo Doctor passes 19/20 checks, with remaining SDK patch/navigation-version advisories documented in the report; the actual dependency graph is valid. Implementation details: `docs/reviews/mobile-parity-implementation-2026-09-09.md`. Connected iPhone is paired; Xcode Personal Team is signed in but has no valid signing identity and Xcode explicitly cannot provision the app because Personal Teams do not support its Push Notifications capability. This is not physical-device acceptance.

Maintain evidence here as each slice completes. Physical device/provider acceptance is distinct from engineering completion.

## Native mobile parity audit — 2026-09-09

- Published the completed pricing/paid-creator slice to main (`4e3ddad`), verified remote SHA.
- Audited native routes, payment/API clients, KYC state flow, profile/media, theme/nav, loading and session handling. Native is not at feature/design parity with web. Critical finding: native KYC posts placeholder information instead of step input.
- Fixed native creator compatibility with the new fee consent contract, paid-plan upgrade/disabled states, fee/net history and default public URL. Corrected the earlier mistaken “no native creator UI” documentation.
- Validation: mobile TypeScript and lint passed; the five existing native logic tests passed (these do not exercise creator UI).
- Remaining gaps and prioritized completion work: `docs/reviews/mobile-web-parity-2026-09-09.md`. This is a source audit, not physical-device visual or provider acceptance.

## Pricing and creator donation review — 2026-09-09

- ✅ Public pricing now reads active/public live plans from `/plans/public`; creation and marketing share plan data. Account-specific compliance caps are explained and preserved. Integration tests cover Free GHS 10,000 and a separate GHS 5,000 cap.
- Reviewed creator tip checkout, settlement and withdrawal: 10 targeted integration tests passed. Not launch-complete: missing `/tip/callback`, input/amount/currency validation gaps, and payout verification remain. Ambiguous-transfer handling is fixed by the paid-creator follow-up. Details: `docs/reviews/pricing-and-creator-donations-2026-09-09.md`.
- Production database access was unavailable; no production plan or compliance value was changed. Published to main in `4e3ddad`.

## Paid creator donations and plan withdrawal fees — 2026-09-09

- ✅ API and web restrict creator setup/new tips to active, unexpired paid plans. Free/trial/expired profiles cannot receive new tips; existing funds remain withdrawable.
- ✅ Creator withdrawals quote the current plan platform-fee percentage, require confirmation of that rate, persist gross/fee/net and send the net amount. Settlement and reversal use the immutable payout fee snapshot; ambiguous transfer errors keep funds reserved for reconciliation.
- ✅ Pricing, features, marketing/member/mobile terms, deployment guide, feature parity and fundraising docs reflect the policy. Canonical contract: `docs/creator-donations.md`.
- Verification: 15 targeted API integration tests, two browser regressions and 39 web tests passed. API/web/marketing/mobile type checks, API/web/marketing lint and web/marketing builds passed (existing bundle-size advisories). Paystack is mocked and MongoDB local. Separate creator launch gaps remain recorded in the pricing review; no live-money acceptance claimed. Published to main in `4e3ddad`.

## Browser session persistence — 2026-09-09

- ✅ Member web and admin automatically renew the 15-minute access token while the browser session is active. A separate one-hour inactivity timeout tracks pointer, keyboard, touch and scroll activity across tabs; background API polling and renewal do not extend it. The persisted timestamp also expires sessions after sleep/reopening.
- ✅ Requests renew near-expiry tokens before sending, concurrent renewals share a request, temporary provider/network failures preserve local login, and revoked refresh tokens still sign out. Late renewals cannot resurrect a signed-out session or overwrite a newer login. Backend token lifetimes remain unchanged; no Render variables are needed.
- Verification: web 39 tests, admin 15 tests, existing session-expiry node tests 4; web/admin/UI type checks and lints; web/admin builds; unused-code audit. Browser inactivity is a client session policy, not server-side refresh-token revocation.

## Verified unfinished-feature audit — 2026-09-09

- ✅ Built real AI campaign writing and admin usage tracking, request quotas, preview/apply protection, and Render configuration. Live OpenAI activation awaits the server-side key and deployment smoke check.
- ✅ Removed mock RBAC editing/invitation forms; retained canonical read-only roles and working authorization. Published affiliate marketing route/navigation/sitemap in source.
- ✅ Removed verified dead modules/dependencies and cleaned unused exports/types; `npm run lint:unused` is clean with explicit tooling/runtime exceptions.
- ✅ Verified workspace type checks/lints and four app builds; web 32, admin 15, mobile 5 tests passed. API 376/379 initially passed, then all 14 affected live/wallet/AI integration tests passed on an isolated replica set after fixing live-session index readiness. AI provider/quota tests: 9 passed.
- Evidence and corrected audit claims: `docs/reviews/unfinished-features-audit-2026-09-09.md`. Activation: `docs/ai-writing.md`. Changes are local; no production provider generation or deployment claimed.

## African Feature Roadmap — GOAL: build all of the below

> Added 2026-09-05 from the crowdfunding-landscape research verdict (survey of Kickstarter/Indiegogo/GoFundMe/Patreon/Kiva/M-Changa/LaunchGood + African payments, diaspora, trust, and community-finance context).
>
> **The frame:** global leaders (GoFundMe, Kickstarter, Patreon) *structurally cannot pay Africans* — the real competitors are M-Changa, LaunchGood, and diaspora rails (LemFi/NALA). Ujimora already holds the hard primitives: Paystack mobile-money + card, a double-entry ledger, Paystack Transfers payouts, LIVE rooms, plans/tiers, and (in progress) coupons + affiliate. The white space no competitor occupies is **trusted + diaspora + mobile-money-native + African community/faith finance, fused**.
>
> **GOAL: complete every feature in this roadmap.** Status legend: ◻ planned · 🔄 in progress · ✅ done. Each row keeps a dated note as it moves.

### Foundation — monetization rail (in progress)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | Paid-subscription Paystack checkout rail (`SubscriptionCheckout` intent, webhook-settled) | 🔄 | Prereq for coupons + affiliate; paid tiers previously hard-threw 409. Types done; backend building (`wf coupons-affiliate-backend`). |
| F2 | Coupons — discount codes at paid-subscription checkout (percent/fixed, limits, validity, plan scope, admin CRUD) | 🔄 | Types done; backend building. $0-coupon activates without charge. |
| F3 | Affiliate / referral program — one-time commission (10% default), hold window + refund clawback, payouts via Paystack Transfers, user dashboard + admin management | 🔄 | Types done (held→available→paid/reversed); backend building. |

### P0 — flagship differentiators (highest leverage)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P0.1 | **Milestone-gated escrow + proof-of-impact + public per-campaign ledger** — hold funds, release tranches only against verified proof (invoice/receipt/geotagged photo), auto-deliver donor impact statements | ◻ | Turns the #1 barrier (distrust) into the product. Direct extension of the existing double-entry ledger + Transfers. THE headline differentiator. |
| P0.2 | **USSD / feature-phone donate-to-shortcode** (`*XXX*campaignID#`) + SMS/WhatsApp receipts + agent cash-in | ◻ | USSD carries ~63.5% of MoMo volume on 2G; zero global crowdfunders offer it. Uncopyable access moat. |
| P0.3 | **Diaspora lane** — multi-currency in → local-currency out, transparent beneficiary-net FX shown pre-confirm, and pay a school/hospital/named vendor **directly** (not cash to an organizer) | ◻ | Owns the corridor GoFundMe abandons; converts the $100B+/yr remittance habit into purpose-locked giving. |
| P0.4 | **Ujimora trust score / alternative credit identity** derived from on-platform ledger behavior (susu contributions, repayments, payout history) | ◻ | Most defensible long-term moat (Esusu's insight for African informal finance). Pure derivative of the ledger + KYC; feeds the microloan/RBF layer. |

### P1 — high value

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P1.1 | **Digital susu/esusu/ajo/chama/stokvel circles** — audited per-member ledger, multi-signatory payouts, automated reminders, cross-border diaspora slots | ◻ | Up to ~95% of adults use informal circles; no interoperable player exists. Treat pooling as a regulated product (Bank of Ghana). |
| P1.2 | **Community vouching + multi-treasurer withdrawal approval** — named vouchers (pastor/chief/elder) co-sign; up to 3 treasurers approve each withdrawal via SMS/USSD | ◻ | Digitizes offline accountability; M-Changa-proven anti-diversion control. Extends the review workflow + gates the payout step. |
| P1.3 | **Life-event campaign templates** — funerals, weddings, school fees, medical, naming/outdooring, harvest/tithe, diaspora family fund | ◻ | Matches the occasions that actually drive African volume. Config over the existing campaign engine. |
| P1.4 | **Recurring mobile-money memberships** (Patreon-style creator→fan) + **faith module** (MoMo tithe/offering/harvest, Zakat-verified badge) with church/mosque admin dashboard | ◻ | The "Patreon Africa can't have." Reuses the existing plans/tiers/feature-gate infrastructure + Paystack recurring MoMo + LIVE gating. |
| P1.5 | **Failure-resilient payments** — smart retry + channel fallback (card fails → USSD/bank/MoMo) + explicit recovery flow | ◻ | Recovers 30–60% of checkout leakage. Enhancement to the existing Paystack integration. Quick revenue protection. |

### P2 — medium / regulated (later phases)

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| P2.1 | Per-campaign funding model choice (all-or-nothing vs keep-it-all) + **digital-first reward tiers** (shoutouts, LIVE access, airtime/data, local pickup) | ◻ | Ledger supports authorize-at-pledge/capture-on-success. Default rewards digital to sidestep the international-shipping trap. |
| P2.2 | **Ujimora Giving Guarantee reserve** — first African donor money-back guarantee, funded from a fee slice | ◻ | Sequence AFTER escrow + proof-of-impact (verification makes claims cheap to honor). |
| P2.3 | **Community microloan + revenue-based-financing (RBF) layer** for cash-flow SMEs; joint-liability group loans; nominee/SPV for many small diaspora backers | ◻ | Lead with RBF over equity. Underwrite from ledger history (the trust score). Regulated: sequence country-by-country (BoG/SEC, Kenya CMA, Nigeria SEC, SA FSCA). |

> **Top-3 to start with** (per the research verdict): **P0.1 the trust/escrow stack**, **P0.3 the diaspora corridor**, **P0.2 USSD access** — after the F1–F3 monetization rail lands. Keep fees transparent and well below the 8–12% Western norm, with no micro-pledge surcharges.

## UX, Theming & Admin Polish — GOAL: fix all + ship multi-theme

- ✅ 2026-09-08 — Crypto UI redesign (web/admin/marketing): web Choose/Review/Transfer flow with explicit network/tag, fees, stale-quote prevention and confirmation; admin provider-backed availability and reconciliation in Payment Providers; new `/crypto` marketing guide and discoverability. Updated public crypto legal disclosures and audited Word draft pack in `docs/reviews/crypto-ui-and-legal-review-2026-09-08.md`. Three app type-check/lint/build checks passed; mocked Playwright mobile/desktop contribution and disabled-gate tests passed (3/3); mocked admin reconciliation and marketing FAQ/mobile overflow checks passed. Screenshots reviewed. No real-money transfer, production provider approval or legal sign-off claimed.

- ✅ 2026-09-08 — Client web mobile bottom navigation: floating glass pill with translucent forest tint, backdrop blur, glossy highlights, rounded ends, a soft shadow, 12px edge spacing, and five persistent tabs (Home, Explore, Start, Dashboard, Profile), centered gold campaign action, active pills, safe-area support, and content/notification clearance. Bottom clearance lives inside the footer so its background continues behind the floating pill; browser assertions cover footer extent and text clearance. Desktop navigation retained. Verified web type-check, lint, and Playwright navigation at 390px/320px and desktop hiding at 1280px. Local API was unavailable during the browser check; authenticated campaign submission was not exercised.

> Added 2026-09-05. Consolidates a run of QA + design requests. ◻ planned · 🔄 in progress · ✅ done.

### Multi-theme design system (web + admin)
- ◻ Selectable "skins": **Neumorphism** (current default) · **Claymorphism** · **Glassmorphism** · plus **Dark** mode. Approach: swap the shared surface/`--neu-*` CSS-var token sets per skin so existing components adopt each look without rewrites.
- ◻ Theme context + persistence (localStorage, later user preference via API) + a Settings picker in BOTH web and admin.

### Loading standards (site-wide: web + admin + marketing)
- ◻ Page/section loads use **skeletons**; buttons use **animated dots** only. Sweep + standardize everywhere.

### Admin dashboard polish
- ✅ Settings route 404 — added `/settings` route (page existed, wasn't routed).
- ◻ User-menu dropdown: descriptions under Profile & Settings.
- ◻ Unify the 404 (`NotFoundPage`) and Access-Denied (`PermissionDenied`) into one branded light design.
- ◻ Recommended empty states — use the shared `EmptyState` component across admin pages (KYC, etc.).
- ◻ Permission: platform owner (admin@ujimora.com) is locked out of `/roles` (the Admin role excludes `roles` by design) — give the owner super-admin (full) access.
- ◻ AI Usage page error — its stats/log endpoints 404 on the backend; implement them or degrade gracefully.

### Registration & campaigns
- ✅ Organization signup wired into the web register form (reads `?role=organization`, org fields + validation).
- ◻ Make the (now longer) organization registration form **stepwise**.
- ✅ Campaign create 400 fixed (endDate → ISO datetime); cover image now persists (`imageUrls` wired through use-case + schema).

### Foundation (earlier) — pending lock-in
- 🔄 F1–F3 (coupons, affiliate, paid subscriptions) built + verified end-to-end; **pending tests + commit**.

## Active workstream

| Workstream | Status | Acceptance evidence |
|---|---|---|
| Current-state reconciliation | COMPLETE | Repository TODO/mock/API/route/mobile-config audit plus fresh workspace checks |
| Soft-delete policy | COMPLETE | User, campaign, update, comment, and organization deletion paths preserve records and ordinary reads exclude deleted entities |
| Backend contracts and frontend wiring | COMPLETE | Routed admin, client, organization, marketing, and mobile workflows use real API contracts with explicit loading/empty/error behavior; unsupported financial rails remain deliberately disabled |
| Dashboard completion | COMPLETE | Admin, individual client, and organization routes use real role-correct contracts; unsupported operator controls were removed rather than simulated |
| Web/mobile parity | IN PROGRESS | `FEATURE_PARITY.md` maps shared capabilities and launch boundaries; physical-device parity smoke testing remains |
| iOS/App Store readiness | BLOCKED — OWNER GATES | Repository metadata, privacy behavior, secure tokens, account deletion, icons, build config, and release checklist are complete; signed EAS/TestFlight builds, final identity/domain, store declarations, screenshots, and physical-device review require owner credentials and decisions |
| CMS expansion | COMPLETE | Public content blocks plus published testimonials are API/CMS-backed with safe runtime fallbacks and protected administration |
| UI/mobile polish | IN PROGRESS | Responsive layouts and shared mobile/web capability paths are implemented; physical phone/tablet accessibility and visual smoke testing remains owner/device-controlled |
| Full review and release gate | IN PROGRESS | Automated lint, type-check, tests, builds, dependency review, and Expo checks pass; signed-build and deployed end-to-end smoke tests remain owner-controlled |
| Naming/domain options | COMPLETE | `PRODUCT_NAMING.md` records collision evidence, positioning, pronunciation, domain strategies, and finalists |

### 2026-09-05 Trust and Safety surface consistency

- Disputes, Verifications, and KYC Review now use the shared admin background, raised queue/filter/loading cards, inset status/risk badges and icon wells, and matching pagination. Removed the page-specific blue-black backgrounds and card border grids.
- KYC detail dialog now uses raised information sections, inset document/notes surfaces, theme text colors, and wrapping responsive actions. KYC cards support keyboard opening. Request failures and loading stats/counts have distinct visible states; empty KYC queues have a message.
- Kept review permissions and decision handlers unchanged. Verification/KYC pagination uses the existing shared hook and neumorphic pagination component.
- Verification: admin TypeScript, targeted ESLint, production build, five existing pagination tests, and diff whitespace checks pass. Existing build chunk-size advisory remains. Browser visual verification remains outstanding.

### 2026-09-05 Community page surface consistency

- Campaigns, Users, Donations, and Subscriptions now use the shared admin background, raised cards/filter bars/loading surfaces, inset badges/detail wells/progress tracks, and consistent spacing. Shared styles live in `apps/admin/src/lib/surfaces.ts`.
- Enabled matching pagination styling for these four pages; retained page-size choices including the current 9/10-item defaults and added keyboard/accessible names to navigation controls. Campaign/user cards support Enter navigation; campaign tabs support keyboard activation.
- Subscription metrics show loading skeletons; subscription dates accept serialized API dates. List counts distinguish loading and unavailable data, and campaign/user/donation request errors are visible.
- Verification: admin TypeScript, targeted ESLint, production build, five existing pagination tests, and diff whitespace checks pass. The build retains the existing bundle-size advisory. Rendered browser verification was not completed for these four routes.

### 2026-09-05 Reports and Audit Log surface consistency

- Reports: replaced the blue-black canvas and border grid with the admin background, shared raised panels, inset geographic table/status tracks, and brand-colored charts. Header metrics and loading placeholders retain the same surface treatment; empty/error states distinguish unavailable reports from zero activity.
- Audit Log: applied raised entry/filter/pagination surfaces, inset search/action badges, visible severity labels, wrapped detail text, and compact accessible pagination. Preserved API search, page size, and request cancellation.
- Verification: admin TypeScript, targeted ESLint, production build, and diff whitespace checks pass; existing bundle-size advisory remains. Browser review could not be completed because the active admin tab kept changing routes during inspection; tab control was released.

### 2026-09-05 Dashboard surface consistency

- COMPLETE: Dashboard now inherits the admin background and uses shared raised/inset shadow tokens and diamond-cut shapes for every section tile and all seven summary cards. Removed the hard-coded blue-black canvas, border grid, generated sparklines, and arbitrary stat-fill graphics.
- Preserved permission-filtered section destinations and API totals; section tiles are keyboard-accessible links. Added stat skeletons, separate platform/KYC failure feedback, and unavailable markers instead of zero totals on failed requests.
- Verification: admin TypeScript, targeted Dashboard ESLint, production build, and diff whitespace checks pass. Build retains the existing large-chunk advisory. Live Dashboard DOM confirmed platform totals and KYC failure handling; full screenshot/responsive verification remains incomplete because browser captures showed a different route and subsequent navigation timed out.

### 2026-09-05 admin sidebar hierarchy

- Added an icon beside all six navigation group titles and visible tree connectors from each group icon to its child items; the final branch ends at the last item and the active branch uses gold.
- Preserved group toggles and route selection, with compact child labels to accommodate the indentation.
- Admin TypeScript, sidebar ESLint, and diff whitespace checks pass. Rendered browser review was not performed.

### 2026-08-09 evidence log

- Confirmed permanent deletes in user, campaign, and campaign-update repositories.
- Converted those repository deletes to `deletedAt` soft deletion and excluded deleted records from normal lookup, list, count, update, and donation increment paths.
- API TypeScript check passed after the soft-delete change.
- API test infrastructure currently requires MongoDB at `127.0.0.1:28017`; the suite stopped in global setup with `ECONNREFUSED`, before collecting tests. This is an environment gate, not a passing test result.
- Confirmed remaining mock/fallback behavior in admin data hooks, audit log and dispute detail; confirmed visible unfinished client copy for comments and dark mode.
- Added admin-only `GET /users/:id`; the user list/detail read model now excludes soft-deleted accounts.
- Added persistent audit records for successful authenticated mutations and admin-only `GET /audit` pagination/search. Audit writes deliberately omit request bodies and credentials.
- Replaced the Audit Log page's fabricated timeline with the real audit endpoint plus honest loading, empty, search, pagination, and error states.
- Removed silent mock fallback data from shared admin API hooks. API failures now retain safe empty states and expose errors instead of presenting demonstration records as production truth.
- Removed the permission context's unauthenticated/error fallback to full Super Admin access. Added authenticated admin `GET /rbac/me` using the canonical admin permission baseline.
- Cleared the admin lint backlog encountered in this slice; fresh admin/API TypeScript and ESLint checks pass. The only emitted lint message is Node's repository-level module-type performance warning.
- Fixed organization registration end to end: validation now accepts only public user/organization roles, requires organization identity fields, persists organization metadata, and issues organization-role tokens. Deleted organizations are excluded from public organization reads.
- Added authenticated `GET /campaigns/mine` and moved web/mobile dashboards and campaign management to server-scoped owner data instead of downloading the public catalog and filtering client-side.
- Removed web/mobile demo credential and fake-token bypasses. Production authentication now fails honestly when the API is unavailable.
- Connected the web forgot-password screen to the real API and removed its visible mock-success disclaimer.
- Added authenticated `DELETE /profile`: account records are soft-deleted and all outstanding tokens are revoked. Web and mobile account deletion now call the real endpoint with legally accurate retention language.
- Added Expo iOS privacy-manifest configuration, encryption declaration, notification plugin configuration, EAS build/submit profiles, production HTTPS API enforcement, and `apps/mobile/STORE_SUBMISSION.md`.
- Removed unverified universal/app-link domain entitlements until a final controlled domain and association files exist.
- Restored Expo's workspace-aware Metro defaults, aligned SDK 55 packages, expanded lint coverage to `app/`, converted React Native animation values away from render-time ref access, and achieved `expo-doctor` 19/19.
- Cleared the remaining mobile lint backlog across application routes and components; mobile ESLint and TypeScript now pass without source warnings or errors, and the mobile Vitest suite passes (1 file, 5 tests).
- Removed the mobile organization directory's fabricated campaign-derived fallback; organization discovery now presents only real API data with explicit failure and empty states.
- Made mobile settings persistence honest and recoverable: failed writes roll back optimistic state and display an inline error instead of silently diverging from the backend.
- Added a role-aware mobile dashboard workspace header and corrected donation labels so `/donations/mine` is accurately presented as the signed-in user's giving history, not donations received by their campaigns.
- Wired the existing authenticated wallet transaction endpoint into mobile, replacing the visible “coming soon” placeholder with real recent activity. Removed misleading no-op deposit/withdraw/transfer controls until a production payment rail is configured.
- Fresh TypeScript checks pass across admin, API, marketing, mobile, web, types, and UI workspaces.
- Replaced mock-generated admin trend, category, geography, and fraud/report panels with admin-only `GET /analytics/reports`, backed by Mongo aggregates. Overview totals and report aggregates exclude soft-deleted users/campaigns.
- API/admin ESLint and TypeScript checks pass after analytics wiring; the admin production build passes. The build reports a non-blocking 1.4 MB entry-chunk optimization warning.
- Re-ran the API suite; global setup still stops before test collection because the required Mongo test service at `127.0.0.1:28017` is unavailable (`ECONNREFUSED`).
- Fixed campaign-update pinning to toggle pin/unpin and refresh locally; update deletion also refreshes without a full browser reload.
- Repaired the shared client RBAC contract: authenticated users and organizations can now retrieve their canonical role permissions from `GET /rbac/me`; the web client no longer grants hard-coded demo permissions when permission loading fails.
- Cleared the web lint backlog found during the review (25 warnings), including unsafe `any` response coercions, stale imports/state, hook dependencies, and permission fallback code. Fresh API/web TypeScript and ESLint checks pass without source warnings or errors.
- Completed campaign comments end to end: shared contract, Mongo persistence, public listing, authenticated posting, author/campaign-owner/admin moderation, and soft deletion. Replaced the web “coming soon” panel and added the equivalent mobile conversation UI.
- Fresh shared-types/API/web/mobile TypeScript and ESLint gates pass after comment integration; web tests pass 17/17 and mobile tests pass 5/5.
- Replaced the admin subscriptions page's generated customer/revenue records with protected `GET /subscriptions`, a real repository read model enriched with member identity, and truthful loading/error/empty states. Subscription counts, plan mix, and projected monthly revenue now derive from persisted records.
- API/admin TypeScript and ESLint checks pass after subscription wiring; the admin production build passes with only the previously recorded bundle-size optimization warning.
- Persisted `paymentMethod` on donations and exposed it across recent, personal, detail, and campaign donation read models. The admin payment-method panel now uses real records; legacy donations safely resolve to wallet. Unsupported provider labels are rejected before any wallet debit.
- Completed the web dark-theme TODO with a persisted color-mode provider, shared light/dark theme factory, immediate settings synchronization, and replacement of hard-coded light page surfaces with semantic theme tokens.
- Added `PRODUCT_NAMING.md` with a live collision/domain screen. `Ujimora` is already used by an active fundraising organization and Android product; the recommended legal/audience-test finalists are TumiRaise and SikaSpring.
- Web lint, TypeScript, tests (17/17), and production build pass after dark-mode and payment-contract changes.
- Closed the remaining source TODO/mock marker sweep. Admins can no longer enable non-wallet providers without a configured live adapter, preventing mobile/web from advertising unusable rails; unsupported transactions are rejected before balance mutation.
- Prevented unpaid subscription escalation: API subscribe/upgrade use cases now reject every non-Free tier until a verified billing checkout exists; web/mobile paid actions are disabled and unsupported plan entitlements are no longer advertised as live.
- Completed a public-claims integrity pass across CMS defaults and marketing surfaces. Removed invented impact totals, testimonials, organization adoption figures, payment rails, payout promises, escrow/live-event claims, recurring giving, API/tax-receipt claims, and fabricated editorial statistics. Replaced them with current platform capabilities and explicit launch-readiness boundaries.
- Corrected refund messaging after tracing the full implementation: web/mobile/API can submit and list refund requests, but approval and settlement are not automatic. Removed false 5–7-day guarantees while retaining the real request workflow and its recorded fee disclosure.
- Removed the admin campaign detail's inert “Force Refund” financial control; no admin UI now implies a settlement action that the backend cannot perform.
- Fresh marketing, admin, web, mobile, and API ESLint and TypeScript gates pass after the subscription, CMS, refund, and claims-integrity changes. Only the repository-level Node module-type performance warning is emitted.
- Replaced the fabricated admin dispute detail with protected `GET /disputes/:id` data and real `PUT /disputes/:id/resolve` writes. Campaign collaborators in admin now come from `/campaigns/:id/collaborators`; fake operator timelines, campaign stats, people, and no-op removal actions were removed.
- Made the admin roles page an honest read-only view of the code-enforced `DEFAULT_ROLES`; removed custom-role and invite-user routes that previously reported local success without backend persistence.
- Added `FEATURE_PARITY.md`. Fixed the organization parity gap: mobile organization cards now match the actual summary DTO and navigate to a new detail screen backed by organization detail and campaign endpoints.
- Marketing, admin, and web production builds pass; web tests pass 17/17 and mobile tests pass 5/5. Marketing/admin bundles retain non-blocking large-chunk optimization warnings.
- Confirmed iOS icon and adaptive icon assets are 1024x1024. Repository metadata includes the privacy manifest, encryption declaration, production HTTPS enforcement, account deletion, bundle/build identifiers, and EAS profiles; signed builds, App Store metadata, legal identity, final domain, screenshots, and physical-device accessibility/smoke tests remain owner-controlled gates.
- Wired admin profile, password changes, and the supported notification/language preferences to real profile/auth endpoints. Removed unsupported local-only preference controls.
- Replaced local-only plan creation/edit/delete/toggle behavior with a read-only view of the actual code-defined subscription policy and removed the fake platform-settings route. No admin control now reports persistence when no backend contract exists.
- Removed fabricated public contact channels, office locations, social destinations, response SLAs, leadership identities, and the unsupported 2030 fundraising counter from marketing fallbacks and CMS seeds. Owner-verified values can still be supplied through the CMS.
- Started an isolated disposable MongoDB test service, updated stale tests to the wallet-only and truthful CMS contracts, and completed the full API suite: 13 files and 100/100 tests pass. The named test container was removed afterward.
- Replaced the admin payment-provider editor's local-only edit/delete controls with an honest read model and the one persisted capability the backend supports: guarded enable/disable toggling.
- Wired admin password recovery to the real forgot-password endpoint. Web campaign and global activity feeds now hydrate from persisted donation reads even when optional SSE transport is disabled.
- Completed testimonial CMS end to end: protected create/update/list/stats operations, published-only public reads, marketing consumption with a truthful fallback, and soft deletion via `deletedAt`. Integration tests prove authorization, publication filtering, and record retention.
- Completed the contact workflow end to end: rate-limited public submission persistence, protected admin inbox/filter/stats, and persisted status/notes triage. Removed the remaining invented email response-time claim.
- Fixed mobile campaign-share analytics to use the environment-aware shared API client instead of a hardcoded localhost URL, restoring real-device parity.
- Fresh API/admin/marketing TypeScript and ESLint gates pass for these slices. Contact and testimonial integration tests pass 3/3 against an isolated disposable MongoDB service, which was removed afterward.
- Completed the post-review monorepo gate: every workspace type-checks and builds; all suites pass (API 15 files/103 tests, web 17, mobile 5, admin 5, marketing 2); Expo Doctor passes 19/19; `git diff --check` is clean.
- Removed the Home page test's asynchronous activity-feed leakage, so web tests pass without React `act()` warnings. Removed the final source lint warning in the shared currency formatter.
- Applied npm's non-breaking dependency remediation. Patched React Router, Axios, `shell-quote`, and other resolvable production dependencies; the production audit has no critical findings. Remaining findings are Expo/Metro/image parser transitives whose npm-proposed fix is an incompatible Expo downgrade, so they are recorded rather than force-applied. Expo remains 55.0.28 and Doctor remains 19/19.
- Completed rendered responsive QA in the browser at 390x844 and 1440x900. Marketing, client login, and admin login have no horizontal overflow; primary form controls and actions retain 46-56px mobile targets. The marketing hero remains legible and structurally balanced at both breakpoints.
- Rendered QA exposed and removed the last hero claim for unsupported mobile-money payouts. Mobile campaign detail now advertises Ujimora Wallet only; web Terms and marketing Privacy copy no longer claim unconfigured fees, payouts, payment processors, or identity-verification partners.
- Closed a critical wallet-integrity gap: removed public authenticated deposit/withdraw routes that allowed direct balance mutation without provider settlement, removed matching web controls, and changed integration/E2E setup to avoid production balance-minting APIs. A regression test proves both former endpoints return 404 while wallet-backed donation accounting remains correct (4/4 tests).
- Fixed mobile campaign reporting to use the real `/campaigns/:id/report` contract. Re-ran the exact frontend/backend endpoint sweep; no remaining references to the removed wallet mutation routes or the invalid mobile `/reports` write remain.
- Migrated Vite/Vitest aliases away from `__dirname` to native ESM URL resolution and renamed the mobile Vitest config to `.mts`, removing the Vite 8 native-config warnings. Web 17/17, admin 5/5, marketing 2/2, and mobile 5/5 tests pass after the migration.
- Hardened iOS authentication storage: access/refresh tokens now use Expo SecureStore (iOS Keychain / Android Keystore) with a one-time migration that removes legacy AsyncStorage token data.
- Moved notification permission behind the explicit Push Notifications settings toggle; sign-in and registration no longer prompt automatically. New profiles default push consent to off.
- Added authenticated push-token registration and soft unregistration persistence. Corrected mobile settings field mapping to the real nested profile contract and removed notification sub-controls that had no backend fields. Push integration tests pass 2/2; mobile type-check, lint, and tests pass.
- Removed the shared simulated AI-writing control and its remaining legacy role-page usage. No frontend now presents deterministic local text transforms as an AI-backed product feature. Admin lint, 5/5 tests, and production build pass; web lint, 17/17 tests, and production build pass. The admin bundle retains its documented non-blocking chunk-size warning.

---

# Previous audit snapshot

> Generated: 2026-05-27  
> Scope: Full monorepo (`apps/*`, `packages/*`, CI/CD, security, architecture)

---

## 1. Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| **Blocking CI/CD** | 3 | Critical |
| **Security vulnerabilities** | 9 | High |
| **Unimplemented stubs** | 4 | High |
| **Missing tests** | 4 | Medium |
| **Architectural gaps** | 8 | Medium |
| **Feature opportunities** | 12 | Low–Medium |

**Immediate action required:** 3 issues currently break the CI pipeline (`mobile lint`, `marketing type-check`, `web test warnings`). A further 9 security issues expose credentials, weaken auth, or leave endpoints unprotected.

---

## Progress Update

### Phase 1 — Stop the Bleeding ✅ COMPLETE
1. ✅ Fixed mobile lint errors (CampaignCard.tsx impure render, SplashScreen.tsx ref access)
2. ✅ Fixed marketing TS5101 (`ignoreDeprecations: "6.0"`)
3. ✅ Fixed web test `act()` warnings (mocked `useFeaturedDonors`)
4. ✅ Rotated secrets in `.env` and `credentials.txt` (replaced with placeholders)
5. ✅ Added `.env` and `credentials.txt` to `.gitignore`
6. ✅ Added production config validation (JWT secret length, distinct secrets)
7. ✅ Fixed web TS5101
8. ✅ Fixed marketing lint error (setState in effect)
9. ✅ Fixed admin type-check errors (8 errors)
10. ✅ Fixed web impure render errors
11. ✅ Fixed web setState in effect errors
12. ✅ Fixed web type-check errors

### Phase 2 — Security Hardening ✅ COMPLETE
1. ✅ Mounted `authRateLimiter` on auth routes (`/register`, `/login`, `/forgot-password`)
2. ✅ Implemented `requireRole` / `requirePermission` RBAC middleware
3. ✅ Applied RBAC to admin endpoints (`rbacRoutes`, `subscriptionRoutes`)
4. ✅ Restricted CORS to known origin whitelist
5. ✅ Added request body size limit (`express.json({ limit: '10kb' })`)
6. ✅ Added server timeouts (`timeout`, `keepAliveTimeout`, `headersTimeout`)
7. ✅ Implemented token revocation / blacklist (jti claims, user token tracking)
8. ✅ Change-password now revokes all existing tokens and issues new ones
9. ✅ Fixed regex injection in `OrganizationController.getBySlug`
10. ✅ Eliminated direct Mongoose model access in controllers (Profile, Organization, Donation, User)

### Phase 3 — Core Architecture ✅ COMPLETE
1. ✅ Wired `CampaignLimitModel` and `CampaignMediaModel` into repositories and use cases
2. ✅ Added `CampaignLimitEntity` with `canCreateCampaign()` / cooldown logic
3. ✅ `CreateCampaignUseCase` now enforces campaign limits
4. ✅ Added MongoDB transactions to `DonateToCampaignUseCase` (wallet → campaign → donation)
5. ✅ Added pagination helper (`parsePagination`, `buildPaginatedResponse`)
6. ✅ Added pagination to list endpoints (Donations, Comments, Notifications, Organizations, Refunds, Verifications, Disputes, Leaderboard)
7. ✅ Added `SearchCampaignsUseCase` with text search, category/status/priority filters, sorting
8. ✅ Added `/campaigns/search` endpoint
9. ✅ Added graceful shutdown (SIGTERM/SIGINT handlers)

### Phase 4 — Infrastructure & Features 🔄 IN PROGRESS
1. ✅ Implemented `RedisCacheService` with `ioredis` (falls back to in-memory)
2. ✅ Implemented `CloudinaryService` with real SDK integration
3. ✅ Expanded email notifications (donation receipt, campaign funded, milestone reached, dispute opened/resolved, verification approved/rejected)
4. 🔄 Payment provider abstraction — NOT YET STARTED
5. 🔄 M-Pesa / Stripe adapters — NOT YET STARTED

### Phase 5 — Quality & Scale 🔄 IN PROGRESS
1. 🔄 API integration tests — pending
2. 🔄 Mobile + admin + marketing unit tests — pending
3. 🔄 E2E tests — pending
4. 🔄 Structured logging — pending

---

## 2. Critical / Blocking Issues (Fix First)

### 2.1 Mobile Lint — Impure Render (`CampaignCard.tsx:22`)
- **File:** `apps/mobile/src/components/CampaignCard.tsx`
- **Error:** `Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / ...)` called during render — violates `react-hooks/purity`.
- **Fix:** Move `Date.now()` into `useMemo` or `useState` + `useEffect` so `daysLeft` is stable across renders.

### 2.2 Mobile Lint — Ref Access During Render (`SplashScreen.tsx:7`)
- **File:** `apps/mobile/src/components/SplashScreen.tsx`
- **Error:** `useRef(new Animated.Value(0.3)).current` — `new Animated.Value()` executes during render.
- **Fix:** Use lazy initializer: `useRef(() => new Animated.Value(0.3))` or initialize in `useEffect`.

### 2.3 Marketing Type-Check — TS5101 (`baseUrl` Deprecated)
- **File:** `apps/marketing/tsconfig.json`
- **Error:** `"baseUrl": "."` is deprecated in TypeScript 6.0; will stop functioning in TS 7.0.
- **Fix:** Add `"ignoreDeprecations": "6.0"` to `compilerOptions` (short-term) or migrate all path resolution to relative `paths` (long-term).

### 2.4 Web Test Warnings — `act(...)`
- **File:** `apps/web/src/pages/HomePage.tsx` → `FeaturedDonorsSection`
- **Error:** `useFeaturedDonors('all', 5)` triggers state updates not wrapped in `act()` during test render.
- **Fix:** Mock the hook in tests or wrap the component render in `waitFor` / `act`.

---

## 3. Security Vulnerabilities (High Priority)

### 3.1 Secrets Committed to Repository
- **Files:**
  - `credentials.txt` — contains the MongoDB URI, demo passwords, and API endpoints. (Actual values redacted here; the file is gitignored and must never be committed.)
  - `apps/api/.env` — contains `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MONGODB_URI`, `RESEND_API_KEY`.
- **Risk:** Credentials are permanently in Git history; anyone with repo access can connect to production DB, forge JWTs, or send emails.
- **Fix:**
  1. Rotate **all** secrets immediately (MongoDB password, JWT secrets, Resend API key).
  2. Add `.env` and `credentials.txt` to `.gitignore`.
  3. Purge from Git history (`git filter-repo` or BFG).
  4. Use environment-specific secrets via CI/CD variables.

### 3.2 Weak / Identical JWT Secrets
- **File:** `apps/api/.env`
- **Issue:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are identical (`***REDACTED***`) and short/weak.
- **Risk:** Token forgery, privilege escalation.
- **Fix:** Generate strong, distinct secrets (≥256-bit, e.g., `openssl rand -hex 32`).

### 3.3 No Rate Limiting on Auth Endpoints
- **File:** `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts`
- **Issue:** `authRateLimiter` (10 req/15min) exists but is **never mounted** on `/auth/*` routes. Only `apiRateLimiter` (100/15min) is applied globally.
- **Risk:** Brute-force attacks on login, registration, password reset.
- **Fix:** Mount `authRateLimiter` on `/auth/register`, `/auth/login`, `/auth/forgot-password` in `authRoutes.ts`.

### 3.4 No RBAC Enforcement on Admin Endpoints
- **Files:** `rbacRoutes.ts`, `subscriptionRoutes.ts`
- **Issue:** Admin endpoints (role CRUD, plan management) only require `authMiddleware` — no role/permission check.
- **Risk:** Any authenticated user can create roles, modify plans, assign permissions.
- **Fix:** Implement `requireRole('admin')` / `requirePermission(Resource.ROLES, Action.CREATE)` middleware and apply to sensitive routes.

### 3.5 Open CORS Configuration
- **File:** `apps/api/src/main.ts`
- **Issue:** `app.use(cors())` with no origin restriction allows any domain to call the API.
- **Risk:** CSRF-like attacks from malicious sites if cookies are ever introduced.
- **Fix:** Configure CORS with explicit `origin` whitelist.

### 3.6 No Helmet CSP Configuration
- **File:** `apps/api/src/main.ts`
- **Issue:** `helmet()` is used with default settings; no Content-Security-Policy for API responses or static assets.
- **Fix:** Configure `helmet.contentSecurityPolicy()` for the API (less critical for JSON-only API, but important if serving uploads).

### 3.7 No Request Timeouts
- **File:** `apps/api/src/main.ts`
- **Issue:** `express.json()` and MongoDB connection lack explicit timeouts.
- **Risk:** Slowloris attacks, hanging connections, unbounded request duration.
- **Fix:** Add `express.json({ limit: '10kb' })` and server-level timeout (`server.timeout = 30000`).

### 3.8 Direct Model Access in Controllers (Bypasses Repository Layer)
- **Files:** `ProfileController.ts`, `OrganizationController.ts`, `DonationController.ts`, `UserController.ts`
- **Issue:** Controllers use Mongoose models directly (`UserModel.findById`, `CampaignModel.find`) instead of repository ports.
- **Risk:** Breaks hexagonal architecture, makes testing harder, bypasses audit logging and business rules.
- **Fix:** Inject repository ports into controllers and route all DB access through them.

### 3.9 No Token Revocation / Blacklist
- **File:** `apps/api/src/application/services/AuthTokenService.ts`
- **Issue:** `refreshTokens()` accepts any valid refresh token with no revocation check. Change-password does not invalidate existing sessions.
- **Risk:** Stolen refresh tokens remain usable indefinitely; password change does not kick out attackers.
- **Fix:** Store issued refresh tokens in Redis/DB with TTL; check revocation on refresh. Invalidate all user tokens on password change.

---

## 4. Unimplemented Infrastructure Stubs

### 4.1 Redis Cache Service
- **File:** `apps/api/src/infrastructure/cache/index.ts`
- **Status:** `RedisCacheService` is a complete stub — all methods return `null` or no-op.
- **Impact:** No distributed caching; in-memory cache is process-local only and loses data on restart.
- **Fix:** Integrate `ioredis`, wire into `main.ts`, add cache-aside pattern to hot read paths (campaigns, leaderboard).

### 4.2 Cloudinary Media Service
- **File:** `apps/api/src/infrastructure/cloudinary/index.ts`
- **Status:** All methods return mock URLs. No actual SDK initialization.
- **Impact:** Campaign images cannot be uploaded; `CampaignMediaModel` exists but is unused.
- **Fix:** Initialize Cloudinary SDK, implement `uploadImage`/`uploadVideo`, wire `CampaignMediaModel` into a repository.

### 4.3 No Real Payment Gateway
- **File:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`
- **Status:** Donations only transfer internal wallet balance. No M-Pesa, Stripe, PayPal, or crypto integration.
- **Impact:** Platform cannot accept real money.
- **Fix:** Design payment abstraction (`PaymentProviderPort`) with adapters for M-Pesa (Africa-focused) and Stripe. Keep wallet as post-payment balance.

### 4.4 Email Service — Limited Coverage
- **File:** `apps/api/src/application/services/EmailService.ts`
- **Status:** Only invitation and password-reset emails implemented. No donation receipts, milestone notifications, dispute alerts.
- **Fix:** Add templates for donation receipt, campaign funded, milestone reached, dispute opened. Wire into `NotificationDispatcher`.

---

## 5. Architectural Gaps

### 5.1 Missing Model Wiring
- **Files:** `CampaignLimitModel.ts`, `CampaignMediaModel.ts`
- **Issue:** Models exist in `database/models` but have **no corresponding repositories or use cases** wired in `main.ts`.
- **Fix:** Create `CampaignLimitRepository` + `CampaignMediaRepository`, wire into use cases, enforce limits at creation time.

### 5.2 No Database Transactions
- **File:** `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts`
- **Issue:** Donation involves 3 writes (wallet withdraw, campaign update, donation save) with no atomicity. Failure mid-way leaves data inconsistent.
- **Fix:** Use MongoDB multi-document transactions (`session.withTransaction`) for financial operations.

### 5.3 No Event Bus / Pub-Sub
- **Issue:** Cross-domain side effects (e.g., donation → notification, campaign funded → email) are inline or skipped.
- **Fix:** Introduce a lightweight domain event bus. Publish `DonationCreated`, `CampaignFunded` events; subscribers send emails, push notifications, update leaderboard.

### 5.4 Missing Use Cases
- **Campaign:** No `UpdateCampaignUseCase`, `DeleteCampaignUseCase`, `ApproveCampaignUseCase`.
- **Wallet:** No `DepositUseCase`, `WithdrawUseCase`, `TransferUseCase`.
- **User:** No `UpdateUserUseCase`, `DeactivateUserUseCase`.
- **Fix:** Implement missing use cases and expose via controllers/routes.

### 5.5 Pagination Missing on List Endpoints
- **Issue:** `OrganizationController.list`, `DonationController.listMyDonations`, `CommentController` lists return all documents.
- **Risk:** Unbounded result sets cause performance degradation and OOM.
- **Fix:** Add `limit`/`offset` (or cursor) pagination to all list endpoints.

### 5.6 No Search / Filter on Campaigns
- **Issue:** `GetCampaignUseCase` appears to fetch by ID only; no list/search endpoint found.
- **Fix:** Add `SearchCampaignsUseCase` with filters (category, country, status, priority, query text) and sorting.

### 5.7 Inconsistent Error Handling
- **Issue:** Some use cases throw plain `Error`, some throw `AppError`. Controllers catch and wrap inconsistently.
- **Fix:** Standardize on `AppError` (or domain-specific errors) with HTTP status codes. Use a single error mapper in `errorHandler.ts`.

### 5.8 No Graceful Shutdown
- **File:** `apps/api/src/main.ts`
- **Issue:** No signal handlers for `SIGTERM` / `SIGINT`. In-flight requests may be dropped.
- **Fix:** Add `process.on('SIGTERM', ...)` to close server, drain connections, disconnect MongoDB.

---

## 6. Testing Gaps

| App | Tests | Coverage | Notes |
|-----|-------|----------|-------|
| `api` | 8 files | Domain + 1 use case | Missing integration tests for controllers, repositories |
| `web` | 2 files | Component + page | Has `act()` warnings; mocks hooks only |
| `mobile` | **0** | — | No test suite at all |
| `admin` | **0** | — | No test scripts in scope |
| `marketing` | **0** | — | No test scripts in scope |

**Recommendations:**
- Add Vitest + React Native Testing Library to `mobile`.
- Add basic render tests to `admin` and `marketing`.
- Add API integration tests (supertest) for at least auth and campaign flows.

---

## 7. Feature Opportunities (Prioritized)

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | **Payment integration** (M-Pesa + Stripe) | Core business function; currently impossible to donate real money |
| P0 | **RBAC enforcement middleware** | Any user can admin; security-critical |
| P1 | **Redis caching** | Performance; stubs already exist |
| P1 | **Cloudinary uploads** | Campaigns need images; stubs already exist |
| P1 | **Campaign search & filter** | Discovery is essential for donors |
| P1 | **Email notifications** (donation receipt, milestone, dispute) | User engagement and trust |
| P2 | **Push notifications** | Mobile engagement |
| P2 | **Real-time updates** (WebSockets / SSE) | Live donation feeds, campaign progress |
| P2 | **Wallet deposit/withdraw/payout** | Complete financial loop |
| P2 | **KYC verification pipeline** | Trust & compliance |
| P3 | **Campaign updates / blog posts** | Creator engagement |
| P3 | **Social sharing (deep links)** | Viral growth |

---

## 8. Recommended Implementation Order

### Phase 1 — Stop the Bleeding (Day 1)
1. Fix mobile lint errors (CampaignCard, SplashScreen).
2. Fix marketing TS5101 (`ignoreDeprecations` or remove `baseUrl`).
3. Fix web test `act()` warnings.
4. Rotate all secrets and purge from Git history.
5. Add `.env` + `credentials.txt` to `.gitignore`.

### Phase 2 — Security Hardening (Week 1)
6. Mount `authRateLimiter` on auth routes.
7. Implement `requireRole` / `requirePermission` middleware.
8. Restrict CORS to known origins.
9. Add request timeouts and body size limits.
10. Implement token revocation / blacklist.

### Phase 3 — Core Architecture (Week 2–3)
11. Wire `CampaignLimitModel` and `CampaignMediaModel` into repositories.
12. Add MongoDB transactions to financial use cases.
13. Implement missing use cases (UpdateCampaign, ApproveCampaign, Deposit, Withdraw).
14. Add pagination to all list endpoints.
15. Introduce a lightweight domain event bus.

### Phase 4 — Infrastructure & Features (Month 2)
16. Implement real `RedisCacheService`.
17. Implement real `CloudinaryService`.
18. Build payment provider abstraction + M-Pesa adapter.
19. Expand email templates and notification coverage.
20. Add campaign search & filtering.

### Phase 5 — Quality & Scale (Ongoing)
21. Add integration tests for API controllers.
22. Add mobile + admin + marketing unit tests.
23. Add E2E tests (Playwright for web, Maestro for mobile).
24. Add structured logging (Pino/Winston) and monitoring.

---

## 9. Quick Reference: File Checklist

| File | Issue | Action |
|------|-------|--------|
| `apps/mobile/src/components/CampaignCard.tsx:22` | Impure render | ✅ Wrap `daysLeft` in `useMemo` |
| `apps/mobile/src/components/SplashScreen.tsx:7` | Ref access during render | ✅ Use lazy `useRef` initializer |
| `apps/marketing/tsconfig.json` | TS5101 `baseUrl` | ✅ Add `ignoreDeprecations` or migrate paths |
| `apps/web/__tests__/pages/HomePage.test.tsx` | `act()` warnings | ✅ Mock `useFeaturedDonors` or wrap in `waitFor` |
| `credentials.txt` | Secrets committed | ✅ Rotate secrets, purge history, add to `.gitignore` |
| `apps/api/.env` | Secrets committed | ✅ Rotate secrets, purge history, add to `.gitignore` |
| `apps/api/src/main.ts` | Open CORS, no timeouts | ✅ Restrict CORS, add `express.json({ limit })`, server timeout |
| `apps/api/src/infrastructure/adapters/inbound/middleware/rateLimiter.ts` | `authRateLimiter` unused | ✅ Mount on auth routes |
| `apps/api/src/infrastructure/adapters/inbound/http/routes/rbacRoutes.ts` | No role checks | ✅ Add `requireRole('admin')` middleware |
| `apps/api/src/infrastructure/adapters/inbound/http/routes/subscriptionRoutes.ts` | No admin checks | ✅ Add `requireRole('admin')` middleware |
| `apps/api/src/application/services/AuthTokenService.ts` | No revocation | ✅ Store refresh tokens, check blacklist |
| `apps/api/src/application/services/EmailService.ts` | Missing templates | ✅ Add donation receipt, milestone, dispute emails |
| `apps/api/src/infrastructure/cache/index.ts` | Redis stub | ✅ Implement with `ioredis` |
| `apps/api/src/infrastructure/cloudinary/index.ts` | Cloudinary stub | ✅ Implement with `cloudinary` SDK |
| `apps/api/src/application/use-cases/DonateToCampaignUseCase.ts` | No real payments | 🔄 Add `PaymentProviderPort` + M-Pesa adapter |
| `apps/api/src/infrastructure/database/models/CampaignLimitModel.ts` | Unused | ✅ Create repository, wire into `CreateCampaignUseCase` |
| `apps/api/src/infrastructure/database/models/CampaignMediaModel.ts` | Unused | ✅ Create repository, wire into campaign flow |
| `apps/api/src/infrastructure/adapters/inbound/http/controllers/ProfileController.ts` | Direct model access | ✅ Inject repository port |
| `apps/api/src/infrastructure/adapters/inbound/http/controllers/OrganizationController.ts` | Regex injection risk | ✅ Escape `slug` before regex; use repository |

---

*End of audit. Estimated effort to reach Phase 3: 2–3 developer-weeks. Phase 4: 1–2 developer-months.*

---

## 10. Application-wide Neumorphism Completion — 2026-08-25

**Status:** ✅ COMPLETE

**Material rules applied**

- Smoke (`#F2EFEA`) is the primary light surface; white is reserved for intentional contrast sections.
- Cards inherit the material of their containing section: smoke on smoke, green on green, and dark green in admin/dark contexts.
- Cards and card-like lists no longer use decorative outline borders; depth comes from paired light/dark shadows.
- Buttons, icon buttons, chips, and decorative icon tiles are raised at rest and hover; inset treatment is reserved for active/selected states, inputs, and recessed wells.
- Dark headers, CTA bands, organization sections, and footers use local dark neumorphic tokens so light/white glow cannot leak into them.

**Coverage**

- Shared UI theme primitives and exports.
- Marketing navigation, footer, homepage sections, CTA, organization, pricing/blog/contact/support surfaces.
- Web header/footer, homepage CTA, campaign/list/activity surfaces, dashboard, leaderboard, profile, wallet, settings, subscriptions, refunds, donations, KYC, and organization pages.
- Admin theme, authentication, settings/profile, content panels, plan forms, dispute and testimonial surfaces.
- Desktop and mobile visual checks for marketing, web homepage/CTA/header/footer, leaderboard, and admin authentication.

**Acceptance evidence**

- `npm run type-check` passes for `@ubuntu-fund/ui`, `web`, `marketing`, and `admin`.
- ESLint passes for all four workspaces (only the repository's existing module-type warning remains).
- Vitest passes: web 17 tests, marketing 5 tests, admin 2 tests.
- Production builds pass for web, marketing, and admin (existing large-chunk warnings remain for marketing/admin).

---

## 11. Mobile, Editorial Pages, and Admin Detail Completion — 2026-08-25

**Status:** ✅ COMPLETE

**Delivered**

- Applied the contextual smoke/green neumorphic system across the Expo mobile routes and shared campaign, comment, and update components. Raised states are used for touch controls; inset states are reserved for inputs and selections.
- Rebuilt the Company/resource page banners as dark-green editorial heroes with contextual green shadows and no light-surface glow leakage.
- Expanded Contact from one incomplete card to four truthful pathways: email support, support availability, Ghana operations, and organization help. Cards are smoke-on-smoke and raised without outline borders.
- Rebuilt Terms, Privacy, and Refund Policy around one responsive legal-document layout: editorial hero, sticky section navigator, raised reading surface, and inset clarification panel. The mobile date chip and “On this page” label are verified on separate rows.
- Redesigned admin login/forgot-password surfaces and sidebar groups with dark contextual neumorphism.
- Fixed admin permissions after login by refetching `/rbac/me` when authentication tokens change and validating malformed permission payloads defensively.
- Converted the admin Overview detailed dashboard and shared page header from outlined panels to raised chart surfaces, inset summary cells, and raised icon tiles.

**Acceptance evidence**

- Mobile: TypeScript and ESLint pass; Vitest passes 5/5; Expo web export completes; 390px login render has no runtime errors or horizontal overflow.
- Marketing: TypeScript, ESLint, and production build pass; Contact, Terms, Privacy, and Refund routes render without page errors at desktop and 390px widths.
- Admin: TypeScript and ESLint pass; Vitest passes 5/5; production build passes; authenticated `/overview` render reports zero permission-denied states and zero page errors.
- Existing non-blocking notices: root ESLint module-type warning, marketing/admin bundle-size advisory, and Watchman falling back to Metro's node crawler during Expo export.

---

## 12. Contact, Donor, and Achievement Composition Redesign — 2026-08-25

**Status:** ✅ COMPLETE

**Delivered**

- Replaced the Contact page's isolated channel-card treatment with a responsive 2×2 support directory: raised smoke surfaces, left-aligned information, raised icon tiles, and quiet ordinal watermarks.
- Replaced the homepage's repeated oversized donor podiums with two compact impact ledgers. Each ledger has one first-place anchor and a readable ranked contribution list without floating medals, white cards, or oversized empty areas.
- Rebuilt the Leaderboard top-three presentation as one restrained ranked set: first place uses contextual dark green, secondary ranks stay smoke-on-smoke, and amounts use tabular figures.
- Rebuilt the eight-column achievement strip as a four-column descriptive collection. Names, unlock criteria, and rarity are now readable without truncated chips; mobile collapses to full-width achievement rows.
- Reduced the achievement palette to the established green, gold, clay, and muted teal family while preserving badge identity.

**Acceptance evidence**

- Desktop renders verified for homepage donor ledgers, leaderboard rank panels and achievement grid, and Contact support directory.
- 390px Leaderboard render verified with no horizontal overflow; achievement cards remain readable and full width.
- Playwright reported zero page errors and zero horizontal overflow across Home, Leaderboard desktop/mobile, and Contact.
- Web TypeScript passes. Full web ESLint remains blocked by pre-existing React compiler findings in `useLiveTotals.ts`, `CampaignPublicPage.tsx`, and `DonateCallbackPage.tsx`, outside this visual slice.

### 2026-09-05 Marketing homepage artwork

- Added two generated Ghanaian community illustrations, compressed JPEG assets in `apps/marketing/public/images/home`, high-priority hero loading and lazy-loaded organization artwork. Source/provenance notes accompany the assets.
- Added three original SVG watermarks (chain, leaf, ripple) and two CSS 3D sculptures (unity links and growing seed), with pointer tilt, click/tap rotation, keyboard controls and reduced-motion support.
- Browser review: verified desktop and 390px mobile layout, image sizing, keyboard rotation and seed click rotation. Fixed an SVG syntax issue and MUI image-width override found during verification. Marketing TypeScript, ESLint, production build and diff whitespace checks pass; existing bundle-size advisory remains.

### 2026-09-05 Live app screenshots across the marketing homepage

- Added four genuine captures of the running app: campaign discovery, campaign creation, public campaign progress, and the initial campaign workspace. All preview frames disclose demo data; crops exclude account identity. Capture provenance is recorded in `apps/marketing/public/images/product/README.md`.
- Integrated 11 screenshot placements across all eight homepage sections, including every How It Works step, a two-column Features showcase, campaign categories, organizations, and the final call to action. Existing generated artwork, watermarks, and interactive sculptures remain in place.
- Added a shared responsive screenshot frame with lazy loading, descriptive alt text, keyboard focus styles, reduced-motion hover handling, and an accessible enlargement dialog.
- Browser verification: desktop at 1440px and mobile at 390px have no horizontal overflow; all 11 product image placements load; enlargement, Close, Escape, and focus restoration work. Marketing TypeScript, ESLint, production build, and diff whitespace checks pass. Existing ESLint module-type and build chunk-size advisories remain.

### 2026-09-05 Admin plans, providers, and roles

- Matched Plans, Payment Providers, and Roles to the shared full-width admin background, raised cards, inset details, and header statistics.
- Plans show readable availability badges, grouped campaign limits and fees, and included features. Roles expose resource/action permissions through keyboard-accessible disclosures.
- Providers show availability counts, inset fee/type details, loading skeletons, distinct failure/empty states, and persistent error notifications. Availability requests are serialized through disabled toggles while a request runs.
- Production build and diff whitespace checks pass. After initial navigation delays, the admin preview redirects to sign-in; authenticated layout review remains unverified. Admin TypeScript and ESLint pass. Removed one redundant borderRadius property in AI Usage that blocked the first TypeScript run; the shared inset style already supplies the effective radius. Existing bundle-size and ESLint module-type advisories remain.

### 2026-09-05 Admin authentication redesign and homepage illustration revision

- Rebuilt sign-in and password recovery around a shared, responsive auth layout with sculpted SVG chain artwork, sage/gold styling, inset inputs, a focused form panel, and consistent recovery/success states. Kept existing login/recovery API contracts; removed the nonfunctional Remember Me checkbox and unsupported status/security claims.
- Replaced the previous homepage screenshot treatment at the user's request: removed captured product images and enlargement dialogs, added four original SVG illustrations for stories, growth, collaboration, and community. Existing generated community artwork and interactive sculptures remain. This supersedes the live-app screenshot deliverable above.
- Admin desktop sign-in and 390px recovery reviewed; password visibility and native empty-email validation verified. Admin and marketing TypeScript, ESLint, production builds, and whitespace checks pass. Desktop illustration composition reviewed; both sites report no horizontal overflow at 390px. Existing bundle-size and ESLint module-type advisories remain.

### 2026-09-05 Homepage foundations strip

- Replaced four oversized statistic tiles and the standalone illustration above them with a compact shared neumorphic surface, inset icon tiles, subtle dividers, and descriptive copy. The four foundations explain cedi giving, web/mobile access, campaign review, and retained records.
- Preserved the marketing.stats CMS integration and custom values. Layout uses four columns on large screens, two on tablets, and stacked rows on phones.
- Production build, TypeScript, targeted ESLint, and diff whitespace checks pass. Both development and production browser previews rendered blank during this check, so visual acceptance remains unverified. Temporary production preview server stopped after inspection.

### 2026-09-05 Branded empty states and date/time controls

- Updated shared web/admin empty states with inset brand surfaces, more compact SVG illustrations, stable React IDs, and reduced-motion handling; upgraded the mobile empty-state presentation. Replaced plain campaign update/comment, QR-code, collaborator, donation-feed, and wallet empty messages with contextual guidance.
- Added shared MUI date/date-time/time pickers styled for light and dark themes, DD/MM/YYYY display, 24-hour time, clear/cancel/accept controls, and local ISO values. Migrated all six native date/date-time controls in campaign creation/editing, KYC, and coupon validity. Corrected existing campaign deadline initialization to preserve local-time display.
- Added a React Native Paper date picker for mobile KYC using the existing mobile theme.
- Live browser: campaign date selection updates the duration, past dates are disabled, clearing works, ArrowRight/Enter selection works, and the picker fits 390px without horizontal overflow. Web/admin production builds, UI type-check, targeted ESLint, and whitespace checks pass. Web, admin, and mobile type checks pass after correcting Date-to-string initialization. Campaign Updates empty state was visually verified in the live app. Added interaction tests, but both fork and thread test workers timed out before executing tests on this machine.

### 2026-09-05 Account menu descriptions

- Added short descriptions beneath Dashboard, My Campaigns, My Donations, Wallet, Affiliate, Settings, and Sign out in the account dropdown. Widened the menu within the viewport limit to accommodate the copy. Navigation and sign-out handlers are unchanged.

### 2026-09-05 Web dark-theme contrast repair

- Added mode-aware brand/text/status CSS tokens and corrected the dark semantic palette, neutral-surface chips, contained button contrast, and browser color scheme in the shared theme. Preserved the sage/gold palette and neumorphic surfaces.
- Replaced light-only text colors across Explore filters/pagination, campaign cards/forms, dashboards, histories, subscriptions, profiles, activity feeds, account menus, recovery screens, and related web components. Preserved intentionally paired cream badges and dark banners. Replaced hex-alpha concatenation with color-mix where status colors now use CSS variables.
- Browser verified: dark Explore titles/amounts use cream, metadata/filters use readable sage, funding status uses brighter semantic colors; Medical filtering returns two matching campaigns; action menu opens. Light-mode backgrounds and text remain correct. Mobile at 390px has no horizontal overflow. Authenticated routes received source-level fixes but could not be visually checked because the browser session is signed out.
- Web TypeScript and production build pass. Full-web ESLint reports 22 pre-existing React-hook errors in useLiveTotals, CampaignPublicPage, and DonateCallbackPage; theme changes do not alter those files. No claim of a complete authenticated route-by-route visual audit.

### 2026-09-05 Homepage campaigns and community activity redesign

- Replaced the uneven featured-card/sidebar layout with six equal campaign cards in a responsive three/two/one-column grid. Added a left-aligned introduction and an always-available Explore link; loading placeholders match the grid.
- Separated raised amounts and funding goals in shared campaign cards, aligned metadata, and added a subtle footer divider.
- Moved recent community activity below campaigns into six readable contribution cards. Donor, timestamp, amount, and campaign link have distinct lines; removed the clipped scrolling panel and decorative live indicator. Existing donation fetching and SSE updates remain active.
- Desktop browser confirms two even campaign rows and a three-column activity section. Mobile at 390px has no horizontal overflow. Targeted ESLint and production build pass.

### 2026-09-05 Campaign detail redesign

- Rebuilt /campaigns/:id with a wide title/header, campaign cover beside a raised funding panel, prominent gold donation action, sharing action, donor count, and deadline. Added a branded fallback for missing covers.
- Simplified the funding presentation to one raised total, goal, progress bar, and percentage. Remaining funding is clamped at zero.
- Added inset navigation tabs with associated tab panels, a comfortable story surface, and expandable QR/embed tools. Preserved donation, editing, deletion, reporting, update, comment, and sharing handlers.
- Browser verified the dark desktop page, light mobile page, donation dialog open/cancel, Updates tab, and mobile sharing disclosure with no horizontal overflow at 390px. Targeted ESLint and production build pass.

### 2026-09-05 404 and splash brand alignment

- Replaced the old splash symbols, hardcoded white background, and layered animations with the current chain-link logo, raised brand tile, themed text/surfaces, and one restrained indeterminate loading bar. Includes a polite loading status and a static reduced-motion state; no artificial loading delay.
- Rebuilt the 404 with a missing-link SVG, inset surface, current typography, and clear Explore campaigns / Back to home links. Removed legacy decorative symbols, delayed text reveals, and unrelated accent colors.
- Browser inspected the real loading fallback and completed dark 404, verified the home action and 390px overflow check. Targeted ESLint and production build pass.

### 2026-09-05 Campaign detail content and contract validation

- Audited the detail surface against mounted API routes, use cases, and live read responses; full evidence and limits in `docs/reviews/campaign-detail-content-audit.md`.
- Corrected wallet-only payment availability, guest sign-in return, deadline/amount/message checks, donation refresh, paginated history, beneficiary display, organizer failure handling, update validation/errors, and share/report behavior. Removed unsupported campaign edit/delete and broken embed controls from the detail page.
- Policy tests: 3 passed. Read-only API checks: 6 endpoints returned 200. Browser confirms actual wallet display, beneficiary, donation history and guest login routing.
- Found independently seeded raised totals and donation records; recorded the discrepancy without rewriting financial data. Owner mutations and live settlement remain unexecuted.
- Final verification: web production build, targeted ESLint, and 3 policy tests pass. Full TypeScript check ended with signal 143 before reporting a result; not marked as passed.

### 2026-09-05 Donor ranking hierarchy and overflow repair

- Replaced the crowded rank/avatar/name/amount arrangement with a first-place highlight: compact identity row, separate full-width contribution total, and contribution count. Remaining donors use ordered, compact rows with smaller avatars and explicit rank numbers.
- All-time and monthly rankings now sit side by side at desktop widths and stack on mobile. All grid tracks allow shrinking; long names and large amounts can wrap instead of being clipped. Loading placeholders match the responsive layout.
- Browser reviewed desktop hierarchy and verified zero overflowing donor rows and no page overflow at 320px. Web production build and targeted ESLint pass.

### 2026-09-05 Campaign organizer and payment card redesign

- Replaced the oversized full-width sections with two balanced inset cards, stacked on mobile. Organizer identity and verification are grouped together; start and closing dates have separate labeled columns.
- Replaced the isolated UF payment tile with a wallet icon, configured provider name, concise balance explanation, and the existing guarded donation/sign-in action. Loading, unavailable-provider, error, and closed-campaign states remain supported.
- Verification badge now inherits the page palette within this section. Public profile data and wallet-only filtering remain unchanged.
- Browser reviewed the rendered cards and confirmed no card/page overflow at 390px. Production build, targeted ESLint and whitespace checks pass.

### 2026-09-05 Registration theme contrast repair

- Replaced fixed dark registration text, step connectors, option borders, and inactive icons with theme-aware palette colors. Selected step and billing controls now use matching foreground/background pairs; account icons and sign-in links retain readable brand accents.
- Added selected-state semantics to account, plan, and billing buttons, active-step semantics, and visible keyboard focus for billing controls.
- Browser reviewed account selection in dark mode and plan selection in both dark and light modes. Details were filled with temporary preview values only; no account was submitted. Production build, targeted ESLint and whitespace checks pass.

### 2026-09-05 Admin provider theme, role access, and affiliate identity

- Fixed shared admin status-chip foregrounds and alert surfaces for dark neumorphic backgrounds. Payment-provider switches now respect update permission and cannot enable non-wallet integrations that the API rejects; unavailable methods explain why. Provider availability was not changed during verification.
- Reproduced Roles access denial for the signed-in Platform Admin. The API process was serving an older role policy despite current source granting admin access. Restarted the local API, reloaded the existing session, and verified System roles renders; no user-role/database privilege changes or client-side permission bypass.
- Admin affiliate listing now enriches names with one batched, name-only user lookup, excluding deleted users. Names appear in the user column, edit dialog, and payout labels, are searchable, and remain after edits. Missing accounts use an explicit unavailable label.
- Browser verified the current account can view Roles, referral code 37bvcth displays Platform Admin, and provider labels/switch states are readable and accurate. Admin production build and targeted ESLint pass; three isolated access-policy tests pass (admin allowed, ordinary user denied, unknown role empty). No payment toggle or account mutation submitted.

### 2026-09-05 Form icons across applications

- Added a shared branded TextField for web, admin and marketing forms. Email, identity, organization, location, phone, link, amount, search and text fields receive decorative leading icons. Existing adornments, currency units, dropdowns, and custom trailing actions take precedence. Password fields without a custom trailing action get an accessible visibility toggle.
- Adopted matching Paper/native input components on mobile auth, campaign creation, KYC, donation, refund and comment forms. Existing mobile search icons and date controls remain intact. Added icons to standalone newsletter inputs and coupon multi-select fields; compact pagination controls remain unchanged.
- All three browser application builds pass. Four component contract tests pass for email semantics, currency preservation, password controls, and multiline/disabled inputs. Browser preview timed out repeatedly; rendered visual review and device review are not claimed. Shared UI and mobile type checks pass. Lint passes for the shared components, adopted form files, and standalone newsletter/coupon fields. Whitespace checks pass.

### 2026-09-05 KYC statistics endpoint and input placeholders

- Traced the dashboard error to its missing GET /kyc/stats endpoint. Added authenticated admin routing, controller/use-case wiring and persisted pending/approved/rejected counts. Today's decisions use reviewedAt within Ghana's UTC day, with an exclusive next-day boundary. Restarted the local API to load the new route.
- Shared browser and mobile inputs now provide label/type-based placeholders while retaining explicit examples. Empty controlled dropdowns show selection prompts, and coupon selectors expose their existing all-tiers/all-cycles defaults. Existing native search/newsletter fields and date controls already provide hints.
- Three KYC contract tests pass (day boundaries, repository queries, admin-only routing); six shared-field tests pass, including placeholder preservation and empty selections. Web, admin and marketing builds pass. Shared UI type checking and targeted lint pass. Live unauthenticated GET /api/v1/kyc/stats now returns the expected 401 JSON instead of 404, confirming the restarted API has the route. Mobile and API type checks also pass. The API check completed successfully just before the attempted cancellation; its process had already exited with code 0. The focused KYC contract tests provide route, access, query and day-boundary coverage.

### 2026-09-06 Appearance menu grid redesign

- Replaced the marketing theme list with a responsive two-column card grid, stacking below 360px. Each skin has a distinct icon, title, short description and decorative inline SVG watermark; the active skin has a gold border and checkmark.
- Added a titled appearance dialog, accessible close control, visible keyboard focus and a separate labeled dark-mode switch. Style changes stay visible in the open panel and use the existing immediate-persistence handlers; dark/light mode remains independent.
- Marketing production build and whitespace checks pass. Browser preview could not complete because the browser connection timed out; no rendered visual verification is claimed. Targeted lint passes.

### 2026-09-06 Marketing dark-mode surface and navigation fixes

- Corrected desktop dropdown and mobile navigation text, icon tiles, active/hover states and dividers to use paired theme colors. The company menu no longer paints dark titles on dark surfaces.
- Removed forced light background/shadow-variable overrides from campaign categories, how-it-works, testimonials, CTA, affiliate benefits and organization feature sections. These now inherit the selected mode and material skin, keeping card surfaces and text in sync.
- Made category icons and step labels theme-aware; fixed the pricing comparison's forced white header and low-contrast availability icons. Fixed forest hero/footer palettes remain explicitly paired with light text.
- Source audit, marketing production build, targeted lint and whitespace checks pass. Browser-rendered verification is not claimed.

### 2026-09-06 Account menu grid redesign

- Replaced the web account dropdown list with a profile banner and responsive six-card navigation grid. Each destination retains its icon, title and description and adds a decorative SVG watermark, route highlight and visible keyboard focus.
- Added a close control and separate sign-out action; preserved existing routes and logout behavior. Theme-aware surfaces and text support light and dark mode, with wrapping for long profile details and a single-column layout on narrow screens.
- Web production build, targeted ESLint and whitespace checks pass. Browser-rendered visual verification is not claimed.

### 2026-09-06 Surface style consistency and settings picker

- Audited skin consumers across web, admin and marketing. Fixed frozen chip hover, input focus and selected-list shadows; theme palettes and baseline tokens now rebuild with the selected skin. Paper surfaces, hairline borders and shared geometry follow the selected finish. Dark-section shadows use skin-specific forest tokens, retaining paired brand colors.
- Replaced fixed neumorphic overrides in navigation, footers, campaign banners, marketing hero/organization sections and admin auth CSS. Decorative artwork and semantic focus rings remain purpose-specific. Minimal now restores correctly in web/admin; skin effects apply before paint.
- Redesigned web/admin settings selectors as a shared responsive two-by-two grid with icons, titles, descriptions, SVG watermarks, isolated finish previews, selected-state confirmation and keyboard focus. Each preview intentionally shows its own finish.
- Three cross-skin regression tests, shared UI type checking, all three browser app production builds, targeted ESLint and whitespace checks pass. Marketing rendered during browser inspection, but opening the appearance menu timed out; full interactive/visual verification remains outstanding.

### 2026-09-06 Member workspace polish and session expiry

- Both web API clients now invalidate rejected active sessions through the auth provider. Expiry checks also run while the app is open and on focus; stale responses cannot clear a newer login. Canonical tokens take precedence over legacy storage, and logout clears both. Protected routes show a session-expired sign-in prompt with the return location. Startup restoration and permission fetching are gated to avoid requesting with a stale token during refresh.
- Dashboard, campaigns, donations, affiliate and settings use shared structured skeletons; wallet retains its card/table skeletons. Affiliate lists also use skeleton rows. Failed data loads are no longer presented as empty donations, zero stats or editable default settings.
- Added consistent icon headings and decorative watermarks, improved dark-mode contrast and amount wrapping, corrected the campaigns dollar label/fabricated donor count and dashboard donations-made label, and added icons/focus states to all web footer links.
- Four session regression tests pass, covering both API clients, late responses, permission errors, unauthenticated login failures, token precedence and expiry parsing. Browser interaction timed out; rendered visual review is not claimed.
- Final web production build, web TypeScript check, targeted lint and whitespace checks pass. The initial TypeScript run caught an incorrectly placed settings loading return; it was moved outside the effect and the full check rerun successfully.

### 2026-09-08 — Organization type selector

- ✅ Replaced the registration dropdown with six responsive choice cards, each with a distinct icon, title, description, and selected checkmark. Uses existing theme colors and native radios for keyboard navigation; preserves API enum values and clears type validation on selection.
- Files: `apps/web/src/components/auth/OrganizationTypePicker.tsx`, `apps/web/src/components/auth/RegisterForm.tsx`.
- Verification: web TypeScript check and production build passed; targeted ESLint and `git diff --check` passed. Browser visual review not performed.

### 2026-09-08 — Profile header redesign

- ✅ Rebuilt the profile header with a compact gold avatar, left-aligned identity, readable bio, separate verification panel, and flat edit/share actions. Responsive stacked mobile layout; removed decorative glow/wave and hard-coded trust score, verification level, and join date. Zero-month streak is hidden.
- Edit profile now scrolls to the settings and focuses the name field. Existing verification navigation and share action retained.
- File: `apps/web/src/pages/ProfilePage.tsx`.
- Verification: web TypeScript, production build, targeted ESLint and diff checks passed. Inspected desktop (1440px) and mobile (390px) browser previews with mocked API data; edit focus and mobile overflow checks passed. These previews do not verify live account data.

### 2026-09-08 — Profile header skin parity

- ✅ Replaced fixed header colors, radii, and shadow suppression with palette and shared skin tokens. Avatar, edit/share controls, verification panel, and icon inset follow the selected skin. Glass adds a subtle backdrop for its translucent panel; light/dark mode remains independent.
- Verification: TypeScript, production build, targeted ESLint, and diff checks passed. Browser screenshots captured all four skins in both modes at desktop and mobile widths using mocked profile API data. Visually inspected the eight-way desktop comparison and dark-glass mobile view; all eight mobile overflow and edit-focus checks passed.
- Visual comparison: `/tmp/profile-skins/comparison.html` and `/tmp/profile-skins/comparison.png`.

### 2026-09-08 — Campaign search and sort redesign

- ✅ Replaced the square search/sort fields with a labeled search surface, clear-search action, and custom sort menu with icons, descriptions, and selected checkmark. Uses shared skin surfaces, shadows, borders, blur, and geometry; mobile controls stack. Search trims surrounding whitespace before matching campaign titles.
- Files: `apps/web/src/components/campaigns/CampaignSearchBar.tsx`, `apps/web/src/pages/ExplorePage.tsx`.
- Verification: web TypeScript, build, targeted ESLint, and diff checks passed. Captured and inspected an eight-way desktop skin/mode comparison and dark-glass mobile menu. Browser checks with mocked empty campaign responses passed for search clearing, sort selection, menu dismissal, and mobile overflow in all eight variants. No live campaign-data verification claimed.
- Preview: `/tmp/campaign-search/comparison.png`; mobile menu: `/tmp/campaign-search/mobile-menu.png`.

### 2026-09-08 — Organization profile and cover images

- ✅ Missing or failed covers render a theme-aware patterned default; missing or failed profile images render organization initials. Owners have Change cover / Change photo editors with device upload, hosted HTTPS link, preview, save, and reset-to-default. Validation/save errors stay in the editor; successful saves show confirmation. Visitors have no editing controls.
- Added cover persistence through the user model/entity/repository and organization projection; authenticated profile updates accept avatar/cover URLs and public organization reads return saved values. Removed the unconditional verified-organization claim from the empty impact copy.
- Verification: API and web type-checks, web production build, targeted ESLint, and diff checks passed. Database-backed integration test covers persistence to personal/public reads, reset, authentication, URL validation, and cross-account protection. Mocked browser checks cover broken/empty images, both saves, reload/reset, mobile layout, and visitor controls; inspected desktop fallback and mobile editor. Device upload uses the existing Cloudinary helper; live provider upload not exercised.
- Visual artifacts: `/tmp/organization-image-fallback.png`, `/tmp/organization-image-editor.png`, `/tmp/organization-image-skins.png`.

### 2026-09-08 — Pricing layout and plan guidance

- ✅ Split plan selection into a three-column personal/growth group and a wider organization/enterprise row. Added a prominent Pro recommendation, audience-fit labels, and an inline current-plan status. Kept public custom tiers and the existing checkout/contact actions. Shared skin tokens control surfaces, geometry, borders, and shadows.
- Prices stay together; yearly monthly-equivalent amounts retain cents. Removed the blanket 17% savings claim because live plan prices can differ.
- Verification: web type-check, production build, targeted ESLint and diff checks passed. Browser previews with seeded fallback plans exercised four skins, annual toggle, Pro checkout dialog, and mobile card overflow; inspected light/dark desktop layouts. No purchase submitted.
- Previews: `/tmp/pricing-redesign-light.png`, `/tmp/pricing-redesign-dark.png`.

### 2026-09-08 — Admin report empty states

- ✅ Replaced one-line report notices with tailored empty states for monthly donations, categories, geography, and campaign status. Each has a distinct icon, clear heading, explanatory copy, and a short report-purpose caption. Shared skin surfaces, borders, shadows, and palette keep all themes consistent.
- Request failures have a separate cloud-off illustration, failure message, and Retry reports action. Empty campaign status uses the same treatment instead of zero-value bars. Loading skeletons and populated reports are preserved.
- File: `apps/admin/src/pages/ReportsPage.tsx`. Admin type-check, production build, targeted ESLint, and diff checks passed.
- Browser verification: captured all eight skin/mode combinations with mocked empty reports; error-to-retry recovery and mobile panel overflow checks passed. Preview sessions suppress the first-visit tour to inspect the actual panels. Visual artifacts: `/tmp/report-empty-skins.png`, `/tmp/report-empty-category.png`, `/tmp/report-empty-mobile.png`.

### 2026-09-08 — Overview empty-state coverage

- ✅ Extracted the Reports treatment into shared `EmptyReport` and applied it to all ten Overview sections, including the five screenshot targets: top campaigns, campaign categories, geography, status, and recent activity. Also covers donation trends, verification, payment methods, trust scores, and safety metrics.
- Each section handles loading skeletons, request errors with retry, empty data, and populated content separately. Removed the fixed eight-region claim; category charts with no positive totals render the empty state.
- Verification: mocked browser checks passed for the original nine empty sections, all five requested mobile states, region count, and report-error retry recovery. Inspected `/tmp/overview-empty-states.png` and captured `/tmp/overview-empty-mobile.png`. The additional safety section follows the same shared component.
- Final admin TypeScript, production build, targeted ESLint, and diff checks passed after adding safety-metrics coverage.

### 2026-09-08 — Admin pagination coverage

- ✅ Added shared pagination (12 records initially) to campaign/beneficiary payouts, AI activity, plan management, and the geographic report table. Existing core admin lists retain their pagination. Payout view changes reset their pages; AI activity no longer silently slices at 20.
- Fixed Contact Submissions and Testimonials to request the selected page size, refetch when it changes, reset on status/type filtering, and retain controls for smaller result sets. These pages now use the admin session token rather than public-app storage keys.
- Verification: admin TypeScript and production build passed; targeted lint and diff checks passed. Mocked browser verification exercised payout row limits, next/last navigation, page-size reset, mobile controls, and server pagination request parameters. Preview: `/tmp/admin-pagination-mobile.png`.

### 2026-09-08 — Payout request failure

- ✅ Reproduced live HTML 404 for `/api/v1/payouts/review-queue` through admin port 8400 and API port 8100. Existing API watcher/child had been running since September 6 and had not picked up current routes. Restarted that local API from current source; observed an authenticated live review-queue request returning 200. All payout routes now respond with authentication protection instead of missing-route HTML.
- Admin API errors now preserve server messages/errors and provide meaningful non-JSON HTTP fallbacks. Payout request failures render a failure state instead of “Nothing needs attention.”
- Verification: new database-backed integration test confirms three admin list endpoints return arrays, require authentication, and deny non-admins. Browser HTML-404/refresh recovery check passed. Admin TypeScript, lint, production build, and diff checks passed. No payout was approved or transferred.

### 2026-09-08 — Marketing feature content refresh

- ✅ Added `/features` with six linked categories covering creator pages, tips and withdrawals, collaboration, campaign updates and LIVE, organisation profiles, checkout methods, payout review and split proceeds, plans/coupons/referrals, verification/reporting, and appearance skins/image defaults. Availability language reflects plan, configuration, and eligibility constraints.
- Added Features navigation and footer entry, replaced the homepage feature previews, and refreshed organisation, pricing FAQ, help FAQ, and signup CTA copy. Removed stale paid-billing-paused and wallet-only claims; organisation plan CTA now links to the API-driven pricing page.
- Verification: marketing TypeScript, ESLint, and production build passed (existing module-type and bundle-size warnings only). Browser checks passed for six sections, six homepage links, organisation pricing link, absence of stale paused copy, zero page errors, and no horizontal overflow at 390px. Visually inspected `/tmp/marketing-features-desktop.png` and `/tmp/marketing-features-mobile.png`. No deployment performed.

### 2026-09-08 — About page operating model spacing

- ✅ Replaced the stretched two-by-two operating-model cards with four compact numbered rows beside the existing editorial image. Added concise supporting details, improved body contrast, and balanced desktop column widths. Semantic ordered steps stack naturally on mobile; forest shadows, borders, blur, and corners respect the selected skin.
- Corrected the About hero trust link to the actual section and updated contribution wording to include current payment methods.
- Verification: TypeScript, marketing lint, production build, and diff checks passed (existing build-size/module-type warnings). Browser verified four steps across all four skins at 1440, 768, and 390px with no horizontal overflow or page errors. Inspected desktop, mobile, and minimal-skin screenshots at `/tmp/about-journey-{desktop,mobile,minimal}.png`.

### 2026-09-08 — About commitments redesign

- ✅ Replaced three separate recessed cards with a unified editorial panel: distinct principle icons, category labels, numbered markers, fine dividers, concise descriptions, and practical takeaways. Revised the section heading and aligned the adjacent philosophy panel without stretching either column.
- Uses shared surface, shadow, border, blur, and shape tokens for all design skins.
- Verification: marketing TypeScript, lint, build, and diff checks passed. Browser checked three commitments in light/dark modes across all four skins at desktop/mobile widths with no overflow or page errors. Inspected `/tmp/commitments-dark-1440.png` and `/tmp/commitments-light-390.png`. Existing module-type and bundle-size warnings remain.

### 2026-09-08 — Confirmed leadership profile

- ✅ Replaced the launch-team placeholder with Stanley Asoku Hayford, his supplied root portrait (copied into marketing public assets), short engineering bio, and Founder & Principal Engineer · NeuroDyne Corp title verified on neurodyne.dev. Added portfolio/company links and LinkedIn, GitHub, X, and Instagram links read from the live portfolio.
- Updated CMS seed defaults and provided a narrow fallback for existing `Ujimora Team` CMS placeholders, while preserving real edited leadership records. Portrait uses initials fallback if loading fails.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser confirmed the live legacy CMS record renders Stanley, portrait loads, six external links render, placeholder copy is absent, and mobile has no overflow. Inspected `/tmp/stanley-profile-mobile.png`.

### 2026-09-08 — Squarer form controls

- ✅ Added independent `SHAPE.input` / `--shape-input` token fixed at 6px across skins. Shared web/marketing and admin outlined/filled controls enforce this radius over older page overrides; adjusted custom admin search, campaign search, newsletter fields, and admin auth styles.
- Card, button, chip, and other surface shape tokens remain unchanged.
- Verification: admin, web, and marketing TypeScript and production builds passed; targeted ESLint and diff checks passed. Browser computed all outlined field radii as 6px on admin login, web login, and marketing contact after cycling skin preferences. Inspected `/tmp/admin-input-radius.png`.

### 2026-09-08 — Features page illustrations

- ✅ Added three existing original SVG scenes for creators, collaboration, and growth with short captions and light/dark colours. Added quiet category-icon watermarks behind feature content, hidden from assistive technology. Balanced creator cards vertically and let odd final cards span the row.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser verified three accessible SVG illustrations in light/dark desktop/mobile layouts with no overflow or page errors; inspected `/tmp/features-art-final.png` and `/tmp/features-art-mobile-dark.png`.

### 2026-09-08 — Full-row leadership profile

- ✅ Moved leadership out of the philosophy card into its own full-width section below the commitments. Enlarged the portrait beside the biography; mobile stacks the photo above the content.
- Replaced loose text buttons with two descriptive destination tiles and a compact social-icon row with accessible link names, hover/focus states, and 44px targets.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser confirmed the independent section, six preserved links, and no desktop/mobile overflow; inspected `/tmp/leadership-wide-1440.png` and `/tmp/leadership-wide-390.png`.

### 2026-09-08 — Marketing pricing parity and contrast

- ✅ Matched subscription-page audience grouping: up to three personal/growth cards, then two organisation/enterprise cards. Added fit labels, a gold Pro recommendation outline/action, and theme-aware fees/checkmarks instead of unreadable configured accent colours.
- Updated cycle controls with selected-state semantics and readable colours, preserved yearly decimal precision, linked paid choices to the web subscription page, removed stale preview-only copy, and made detailed comparison horizontally scrollable on narrow screens.
- Browser verification: light/dark desktop and mobile, yearly toggle, two groups, no overflow/page errors; inspected `/tmp/pricing-group-dark.png`. Marketing type-check, lint, build, and diff checks run for this change.

### 2026-09-08 — Marketing page transitions

- ✅ Added coordinated 150ms outgoing fade and 380ms incoming reveal across marketing routes, including the homepage. Routes retain the outgoing content during exit; pending route changes cancel cleanly. Removed the duplicate inner-page entry animation.
- Same-origin native links now use SPA navigation while preserving router links, external links, modified/new-tab clicks, downloads, and same-page anchors. Scroll reset follows the displayed page. Keyboard navigation and reduced-motion preferences bypass animation; reduced-motion hash scrolling is immediate.
- Verification: marketing TypeScript, lint, production build, and diff checks passed. Browser verified document-preserving navigation, Back, section hashes, reduced-motion CSS, rapid successive routes, and no page errors.

### 2026-09-08 — Campaign creation plan enforcement and workflow audit

- ✅ Added authenticated `/campaigns/creation-options` resolving the same DB-backed effective plan/compliance cap as server creation. Form fails closed when limits cannot load, shows the current cap/usage, and blocks excessive goals or unavailable capacity. Server now rejects non-finite goals, invalid/end dates, non-GHS campaign goals, and excess media; entitlement reads do not silently substitute seed caps after DB read failures. Paid entitlements expire by billing/trial end as well as status.
- ✅ Found and fixed a browser submit-default bug: the goal-step Continue button could become a submit button during its click and publish before the review step. Cancelled that click default and blocked submission outside review. Preserved regression in `apps/web/e2e/campaign-plan-enforcement.spec.ts`.
- ✅ Added creation-time editor invitations and optional split allocations, gated by server-provided capabilities. Split draft creation/activation requires the owner's current collaboration + escrow features and the platform split flag. Invitations retain server feature/count guards; accepting old invitations rechecks current owner entitlement/count. Positive collaboration revenue shares require escrow entitlement.
- ✅ Optional setup failures retain the created campaign and offer retry of only unfinished requests. Split setup remains a draft until explicit beneficiary acceptance recording and activation; owners can return to this workflow on the campaign detail page. Success copy follows actual campaign status. Sharing on live success now offers WhatsApp, Facebook, X, LinkedIn, copy/Instagram, and native device sharing; sharing is not artificially paywalled.
- ✅ Restarted the stale local API watcher (old process did not recognise the new endpoint) from current source with polling enabled; live creation-options now returns the expected unauthenticated 401 instead of treating it as an invalid campaign ID.
- Verification: 26 targeted unit tests, 11 integration tests across creation enforcement/split configuration/accrual/beneficiary payouts passed across runs. Updated eligible split fixtures to Pro and its 2.5% fee rather than retaining Free-plan assumptions. Playwright regression passed with mocked UI API responses: cap enforcement, no creation before review, one creation, failed invite retry, one split, social menu. API/web TypeScript, targeted lint, web production build, and diff checks passed. No production campaigns, invitations, subscriptions, or payouts were modified by verification.

### 2026-09-08 — Blog newsletter shadow correction

- ✅ Scoped the dark blog newsletter panel to the shared forest surface variables so its gold Subscribe button uses the selected skin's dark shadows instead of a bright light-mode halo. Input, card, and button shapes retain their existing skin settings.
- Verification: marketing TypeScript and targeted ESLint passed. Browser checked `/blog` in light and dark modes; Subscribe uses dark/sage shadows in both. Inspected `/tmp/blog-newsletter-light.png`.

### 2026-09-08 — Explain campaign creation eligibility accurately

- ✅ Replaced the combined campaign/verification limit warning with explicit API reasons: verification required, verification campaign allowance exhausted, or active plan capacity exhausted. Unverified first-time creators see a verification explanation and `/kyc` action instead of an upgrade prompt.
- Verification: integration regression passed for zero-campaign unverified, verified eligible, and active-plan-full accounts. Mocked browser verified verification copy and `/kyc` link. Web TypeScript and targeted lint passed. API TypeScript is blocked by the existing payout repository missing `attachTransferDetails`; no payout files changed in this slice.

### 2026-09-08 — Blog newsletter skin surfaces

- ✅ Newsletter panel now consumes skin shadow, border, and blur tokens; email field uses the skin's inset surface. Glass receives a translucent forest background. Preserved gold CTA, forest colors, and 6px input corners; improved placeholder and keyboard-focus visibility.
- Verification: browser checked all four skins and inspected neumorphic/clay screenshots. Marketing TypeScript, targeted lint, and diff checks passed.

### 2026-09-08 — Admin users and member detail redesign

- ✅ Removed the detail page's hard-coded black/purple background and pale text; profile, compliance, activity, loading, and error states now follow semantic theme colors and selected skin surfaces. Added avatar fallbacks, readable account metadata, verification guidance, and a back link.
- ✅ Replaced inert Verify/Suspend/Ban controls with a working verification-workspace link; preserved compliance-limit saving. Added pagination for loaded member activity and explicit activity errors/loading rather than false empty results. Activity remains sourced from the existing recent platform feeds.
- ✅ Simplified user directory cards, widened desktop columns, preserved pagination, reset pages on filter changes, and added clear-filters recovery.
- Verification: admin TypeScript, targeted ESLint, production build, and diff checks passed. Browser used mocked API data on both routes across four skins, light/dark and 390/1440 widths: no overflow or page errors. Inspected desktop screenshots after dismissing the onboarding tour. No live user records were changed.

### 2026-09-08 — Category icons and admin collection views

- ✅ Replaced creation-category diamonds with distinct category icons and a generic fallback; raised/inset surfaces and blur follow the selected skin with an explicit selected border and accessible pressed state.
- Category management audit: creation uses the shared CampaignCategory enum, with matching API enum validation. No admin category CRUD exists. Used the owner's offered UI-only scope; adding arbitrary categories still requires a shared schema/code change.
- ✅ Added reusable Cards/Table control and horizontally scrollable semantic table for admin users/campaigns. Each collection remembers its layout locally; both layouts share filters and pagination. Filter changes reset to the first page. Removed campaign cards' fabricated update counts and inert moderation buttons; records link to campaign detail.
- Verification: admin/web TypeScript, targeted lint, admin build, diff checks passed. Mocked browser checked table rows, card switching, reload persistence, light/dark desktop layouts and narrow layouts. Category selection and seven icons checked in all four skins; inspected category and table screenshots.

### 2026-09-08 — Help support card redesign

- ✅ Replaced pale cards and white halos in the forest contact band with dark skin-aware surfaces, gold inset icon holders, readable descriptions, and clear contact links. Skin geometry, shadows and glass blur remain responsive to appearance settings; mobile cards stack.
- Replaced conflicting response-time promises with practical contact guidance.
- Verification: marketing TypeScript and targeted lint passed; browser checked all four skins at desktop/mobile widths without horizontal overflow. Inspected `/tmp/help-support-neumorphism.png`.

### 2026-09-08 — Searchable KYC nationality

- ✅ Replaced free-text nationality with a searchable country autocomplete, retaining a string in the existing API payload. Only listed selections are accepted; clearing/unmatched typing cannot advance the nationality step or submit. Popup surfaces follow the selected skin and existing input geometry.
- Verification: web TypeScript and targeted lint passed. Browser checked Ghana search/selection, clearing, unmatched input blocking, and keyboard Canada selection. No KYC submission sent.

### 2026-09-08 — Subtle help accordion borders

- ✅ Replaced bright fixed FAQ outlines with low-opacity forest/sage borders for light/dark modes. Hover and expanded outlines stay subtle; selected skin surfaces remain intact.
- Verification: marketing TypeScript and diff checks passed; browser checked FAQ border styling and expansion.

### 2026-09-08 — Consistent 4 MB image limit

- ✅ Reduced shared upload label and browser size validation from 10 MB to 4 MB. Profile/cover editors reuse the same exported limit for validation and messaging. Upload transport remains direct to Cloudinary.
- Verification: web TypeScript, targeted lint, and diff checks passed.

### 2026-09-08 — Responsive KYC steps and uploads

- ✅ Replaced the overflowing mobile stepper with current-step text and a compact four-part indicator. Desktop retains labelled steps. Front/back uploads and paired address fields now stack below 600px, with shrinkable columns above that width and reduced mobile padding.
- Verification: browser traversed all four steps at 320/390/768px with no horizontal overflow; upload positions confirmed vertical stacking on phones and side-by-side at tablet width. Inspected mobile screenshot. Web TypeScript, targeted lint, and diff checks passed. No documents uploaded or KYC submitted.

### 2026-09-08 — Support card SVG watermarks

- ✅ Added oversized, low-opacity gold email/chat/group SVG watermarks in support card corners, clipped within skin surfaces and excluded from interaction/accessibility. Inspected browser screenshot `/tmp/help-watermarks.png`; lint and diff checks passed.

### 2026-09-08 — Personal and organisation image editing

- ✅ Added personal profile cover display/default and visible Change cover / Change profile image controls using the shared editor. Images load independently of analytics, save through the authenticated profile endpoint, and render immediately. Broken covers fall back safely; avatars retain initials. Organisation owner controls already existed; clarified Change logo label.
- Verification: web TypeScript and targeted lint passed. Mocked browser checked personal avatar/cover saves, reload display, restore default, and 390px overflow; checked organisation owner controls save avatar/cover fields and visitors cannot see editors. Shared editor retains 4 MB validation and upload/URL preview. No live account records changed.

### 2026-09-08 — Default profile artwork

- ✅ Added local SVG fallback artwork: personal portrait, organisation building, and linked-shape landscape cover. Applied to personal and organisation profiles and organisation directory logos. Uploaded images take priority; missing/failed avatar images render artwork via Avatar fallback, while failed covers expose the background art. Artwork inherits semantic skin colors and needs no external image request.
- Verification: web TypeScript, targeted lint, diff checks passed; inspected mobile profile fallback screenshot with no horizontal overflow.

### 2026-09-09 — KYC address selection, dashboard actions, and admin sign-in

- ✅ Added `country-state-city` searchable country/region/city controls using the brand's themed dropdown surfaces. Country/region changes reset dependent selections; unlisted towns allow manual entry and postal code is optional.
- ✅ Ghana residents can choose GhanaPost GPS or document proof. GPS format is validated, persisted in the KYC record and shown to admin reviewers; document submissions require street address and proof upload. GPS remains subject to manual review, with no automatic location/ownership verification. Older clients retain their existing API contract.
- ✅ Dashboard New Campaign, Invite Friends and My Donations navigate to creation, the affiliate invitation workspace and donation history.
- ✅ Admin login excludes stale bearer tokens and displays credential errors instead of incorrectly calling every login 401 an expired session. Protected-request expiry clears all three authentication storage entries; incomplete stored sessions no longer restore authenticated state.
- Verification: API address-validation/model regression passed; three mocked Playwright tests passed for mobile GPS submission, dependent location resets and quick-action navigation. Four admin HTTP authentication regression tests passed. Web/admin/API type checks, targeted lint, web/admin builds and diff checks passed. Inspected mobile address screenshot. Live admin credentials and provider verification were not exercised.
- Build note: country-state-city's worldwide dataset adds a large KYC route chunk (about 2.4 MB gzip); it is isolated from the initial application bundle by route loading. Builds retain chunk-size warnings.

### 2026-09-09 — Admin KYC document visibility

- ✅ Fixed detail dialog rendering only document metadata despite receiving file URLs. Each document now shows an image preview or PDF viewer plus a labelled Open original link, using the existing themed surfaces.
- ✅ Added loading skeletons, image-preview failure recovery, invalid/missing URL messaging, safe HTTP(S) links, distinct document numbering, missing-date fallback and zero-document guidance for GPS submissions.
- Verification: four component regressions passed for image loading, failed previews, PDF query-string URLs and unsafe URLs. Admin TypeScript, targeted lint, production build and diff checks passed. Production member documents were not accessed; PDF availability remains dependent on the upload host/browser.

### 2026-09-09 — Profile upload consistency and campaign display accuracy

- ✅ Profile/cover editor now reuses campaign creation's shared ImageUpload control with preview, progress, replace/remove, the 4 MB cap and the same API upload transport (`profiles` folder). Square avatar and landscape cover previews retain explicit save/default controls. Save/close are disabled during upload.
- ✅ Fixed light-mode semantic chip text colors against the shared pale surface, including Critical and Urgent; existing dark-mode colors remain intact.
- ✅ Confirmed the dashboard campaign card hardcoded 147 supporters and four initials. Replaced them with API donorCount, correct singular/plural text and a neutral people icon. Verified `/campaigns/mine` already populates distinct donor counts via the donation repository.
- Verification: three mocked browser regressions passed for zero/one supporter counts, Critical badge computed color, and profile/cover upload plus save payloads. Inspected campaign urgency and image-editor screenshots. Web/UI TypeScript, targeted lint, production web build and diff checks passed; existing large-chunk warnings remain. No live member images changed.

### 2026-09-09 — Legacy wallet provider branding

- ✅ Canonical platform wallet providers now display Ujimora Wallet in the shared enabled-provider hook, even when persisted API records contain the old UbuntuFund name. Provider identifiers, availability and payment behavior are unchanged.
- Verification: mocked campaign-detail browser regression passed using the legacy API name and asserting Ujimora Wallet in How to donate. Web TypeScript, targeted lint and diff checks passed.

### 2026-09-09 — Campaign checkout access and wallet funding investigation

- ✅ Campaign detail's primary Donate now CTA and How to donate section link to the existing card/MoMo checkout without depending on the wallet-provider list. Existing-balance wallet donations remain secondary. Closed campaigns disable checkout links.
- ✅ Public campaign resolution falls back to a valid Mongo ID when a vanity slug is missing, so legacy detail pages can use checkout. Added regression for ID resolution and missing-slug handling.
- ✅ Wallet and campaign copy explain that external top-ups are not implemented and hosted donations fund the campaign directly, not the user's wallet.
- Production read-only findings: enabled-provider endpoint returns only the legacy-named wallet; crypto-assets endpoint returns enabled:false and no assets. Render blueprint enables Paystack but requires dashboard-provided keys. Local production env has a Paystack test key; this does not establish deployed key mode or payment readiness. No access to deployed secret configuration was established and no payment transaction was initiated.
- Crypto blocker: app.ts registers only MockCryptoProvider; enabling the feature is not a live-provider integration. Production crypto remains disabled pending real provider implementation/configuration.
- Wallet finding: registration creates a zero-GHS wallet; wallet routes are read-only. No self-service top-up initialization/webhook flow exists. depositAtomic calls in donation use cases compensate failed wallet debits rather than load external funds.
- Verification: nine mocked browser tests passed, covering guest checkout navigation for slug/legacy ID campaigns with no wallet providers, crypto off/on flows at mobile/desktop, and the earlier profile/branding fixes. Legacy public API regression, web/API type checks, targeted lint, production web build and diff checks passed. Large bundle advisories remain. Hosted payment configuration and real settlement are not externally verified.

### 2026-09-09 — Wallet funding and real crypto providers (engineering implemented; external acceptance pending)

- Scope: Paystack-verified wallet top-ups with atomic ledger/balance settlement; current-contract crypto provider implementation and provider-pinned routing. Existing unrelated profile/campaign changes remain pending in this worktree.
- Provider research: supplied crypto DOCX names Yellow Card, Paychant and Bitnob. Current Bitnob documentation supports address issuance, authenticated rates, signed deposit webhooks and transaction reconciliation. Yellow Card custody docs expose vault/address creation but the documented transaction-list example currently describes sends; receipt correlation/reconciliation requires provider confirmation before it can act as a reliable fallback. Paychant primarily documents a hosted on/off-ramp widget.
- Live keys: Paystack approval pending per owner; build/test against test-mode contracts. Crypto sandbox credentials requested; no live enablement or claim of external verification.

- ✅ Added authenticated Paystack wallet top-up checkout, availability/test-mode display, owner-only status verification, signed webhook dispatch and pending-payment reconciliation. Wallet balance, history and balanced journal settle atomically with duplicate-credit protection. The full top-up credits the wallet; Ujimora absorbs processor fees.
- ✅ Implemented Bitnob against its current HMAC API: allowlisted USDT/USDC networks, decimal quotes, idempotent receiving addresses, signed webhooks and authenticated receipt reconciliation. Exact amount/asset/network verification precedes campaign settlement. Production excludes mock providers.
- ✅ Added ordered quote/discovery fallback routing and provider-pinned deposits. Only Bitnob is a real registered adapter; Yellow Card requires authoritative receive contracts and sandbox verification before it can be registered. No second live adapter is claimed.
- Verification: 22 payment integration tests passed across wallet, Bitnob, existing Paystack and crypto suites; latest targeted rerun passed 11 tests. Provider-routing contract passed. API, web and admin TypeScript checks passed. Provider calls are mocked; no credentialed sandbox or live payment was run.
- Setup, limits and provider sources: `docs/payments/wallet-funding-and-crypto-providers.md`. Crypto remains disabled pending credentials and sandbox acceptance. Paystack live keys remain pending owner approval. This entry supersedes the earlier no-top-up/read-only-wallet findings for the local implementation, not the deployed application.
- Browser verification: two wallet top-up regressions passed, covering authenticated/idempotent hosted checkout, pending-to-confirmed feedback and initialization failure. Targeted lint and diff checks passed.
- Owner confirmed Bitnob account creation and authorized commit/push. Bitnob is the initial provider; secondary-provider onboarding remains deferred. Crypto stays disabled until credentials and sandbox verification are complete.

### 2026-09-09 — In-app live broadcasting, appearance and mobile menu

- ✅ Reworked Go live into a preview/workspace plus session setup. Panels now use the selected Settings appearance tokens; no separate overlay-design picker remains. Mobile menu has SVG icon/chain watermarks, grouped navigation, active/focus states and selected-skin surfaces.
- ✅ Audited the original live flow: fundraising API/SSE worked, but video transport was absent, session recovery depended on browser storage, repeat starts were not protected, and public live QR destinations had no viewer route.
- ✅ Added owner-only server recovery, one-active-session uniqueness/idempotent start, public active-session discovery, authenticated publishing/guest watch-only LiveKit tokens, host media controls, public viewer routes, viewer donation attribution and provider-room shutdown on End. New broadcasts are disabled until video credentials are configured.
- ✅ Added static pre-live overlay preview, controlled cross-origin framing, authoritative overlay refresh, and current token/session/privacy revalidation for live SSE delivery and replay.
- Verification: 17 API tests, seven frontend regressions and one static overlay contract passed. Browser inspected mobile menu SVG watermarks, desktop studio and selected claymorphism on mobile with no horizontal overflow. Production web build passed with existing KYC and new lazy video chunk size advisories.
- External acceptance pending: LiveKit Cloud project credentials, real camera/audio/screen-share + guest playback/reconnection/shutdown checks, production index preflight and Paystack live acceptance. Setup and operational limits: `docs/live-broadcasting.md`. No live broadcast or real payment was initiated; publishing is authorized below.
- Final validation: 15 short-link/QR regressions also passed; API/web/admin type checks and targeted lint passed. Video remains a credential-gated integration, not a claim of externally verified media transport.
- Owner confirmed streaming credentials are ready and authorized publishing to main. Added LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to render.yaml as dashboard-managed values, with existing-service manual-entry guidance. Credentialed broadcast acceptance remains pending after the owner configures Render.


### 2026-09-10 — Payout status recovery, automation and amount shortcuts

- Verified the reported test transfer against Paystack: provider success while Ujimora remained PROCESSING. Reconciled payout `6aa2b6b47d2991e8970e0c9f` through the existing settlement handler; repeated reconciliation leaves one journal entry, paid-out GHS 4,837.62, and zero eligible campaign balance. No new transfer initiated.
- Live browser verification: admin All payouts shows PAID; owner campaign history shows Completed, GHS 4,837.62 already paid, and GHS 0.00 eligible. An external MTN payout does not credit the Ujimora Wallet.
- Added provider-verified list refresh, 30-second/focus refresh on web/admin, five-minute scheduled recovery, OTP authorization/resend for existing transfers, expired/failed transfer recovery, and OTP work in the admin action badge.
- Added audited, configurable automatic campaign payout policy, disabled by default. Only eligible repeat, reviewed destinations qualify; transactional daily limits, independent MoMo limits/review age, identity/dispute checks, and existing fee/dual-approval rules apply. New request idempotency keys cover external payouts as well as wallet requests. Optional provider approval endpoint matches reserved references, amounts and recipients.
- Added 25%, 50%, Max cashout shortcuts on web and native mobile, based on the selected service cap and rounded to pesewas.
- Validation: 25 targeted API tests and eight owner UI tests passed, including concurrent refresh without a webhook, duplicate settlement, policy race limits, expired MoMo review, OTP controls and exact decimal shortcuts. API/admin/web/mobile type checks and admin/web production builds passed; existing bundle-size advisories remain. Lifecycle test now waits for uniqueness indexes before concurrent requests.
- External acceptance: production test payout is reconciled and visible. Automatic payout policy remains off; Paystack OTP preferences and optional approval URL have not been changed or provider-tested. Native updates require a new app build. Setup: docs/payments/automatic-payouts.md.


### 2026-09-10 — Reports guest-ID crash and native mobile parity

- Reproduced production report failure read-only: MongoAnalyticsRepository.getReports threw CastError for donorId `guest`. Filtered non-Mongo IDs from user/campaign lookups while retaining donations in totals and Unspecified geography. The corrected query against production returns total GHS 5,200, Business GHS 5,200, Ghana GHS 1,000 and Unspecified GHS 4,200; fraud metrics return successfully. No production data modified.
- Native mobile: cashout loads history before balance, refreshes every 30 seconds while active and on foreground; payout cards show net/gross/fee/status and selectable request/provider references with themed surfaces and watermarks.
- Added authenticated global notification bell and unread badge, shared inbox state, skeleton/error/illustrated empty states, mark-as-read and foreground polling. Logout invalidates in-flight responses. Shared native empty states now include icon/link watermarks.
- Verification: guest/legacy analytics integration regression passed; 26 mobile tests passed including notification shared state and stale-response logout isolation; API/mobile type checks and targeted lint passed. iOS/Android Metro export acceptance recorded below. No physical-device visual acceptance or store release is claimed; installed clients need an updated app build.
- iOS and Android production JavaScript/Hermes exports both passed. Outputs remain in /tmp; no store binary was built or published.


### 2026-09-10 — Readable admin records and card/empty-state redesign

- Audit logs now batch-resolve actor names and campaign/payout descriptions, support searching actor names, and preserve raw actions/paths/actor references under technical details. Read-only production verification resolves the reported approval to Ujimora Admin, campaign title and GHS 4,837.62. Missing accounts have a readable fallback.
- Campaign payout console resolves campaign titles and approver names, labels paid as Completed and collapses provider references/codes into technical details. Raw references remain unchanged.
- Donation cards use payment-method icons and ghost watermarks, clear donor/campaign hierarchy, a single currency amount and full wrapping campaign titles. New Paystack settlements record verified MoMo/bank channels rather than always Card; existing donation records were not relabeled without verification.
- AI writing usage uses one shared illustrated empty state and skeleton loading; user names replace user IDs in usage rows.
- Role cards use distinct role icons/watermarks and permission/resource counts; expanded permissions use an accessible View/Create/Edit/Delete matrix. Actual roles and permission grants are unchanged.
- Validation: 13 API tests and three AI usage UI tests passed; API/admin type checks, targeted lint, diff checks and admin production build passed. Existing admin bundle-size advisory remains.

### 2026-09-10 — Badge hierarchy

- Replaced the mixed badge grid with labeled Common → Rare → Epic → Legendary tiers. Each badge appears once under its existing rarity; thresholds and award logic are unchanged. Rows stack on narrow screens and retain themed cards/subtle dividers.
- Web type check, targeted lint, production build and diff check passed; existing bundle-size advisories remain.

### 2026-09-10 — Correct badge hierarchy to supplied reference

- Supersedes the preceding ascending tier-row layout: centered descending hierarchy with Legendary at the peak, Trailblazer/Genesis Donor paired above centered Legend, then Epic/Rare pairs and centered Common. Added subtle connecting lines/nodes and centered tier headings; narrow screens stack without changing badge order or requirements.
- Web type check, lint, production build and diff check passed.

### 2026-09-10 — Admin profile save repair

- Found admin profile initialized only from the auth summary, never fetched saved profile/preferences, and always submitted country:'' although API requires at least two characters when provided.
- Load persisted profile before enabling editing; show skeleton and retry on load failure. Trim fields, omit unset optional country, retain existing contact/preferences, update auth display name after confirmed save, and show actionable server errors persistently.
- Three profile regressions passed (load/save without country, save error retains data, load failure/retry); admin type check, targeted lint, diff check and build passed. No live user profile or password was modified during verification.
