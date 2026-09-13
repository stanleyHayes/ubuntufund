# Administrative exports

Implemented 12 September 2026. Compliance remains active; final commit/push is pending.

Every applicable admin surface offers PDF, Excel (.xlsx) and CSV through shared export controls. PDF and workbook engines load only when selected. Files are generated in the administrator's browser; reports are not uploaded to an external conversion service.

## Coverage

| Admin surface | Exported data and selection |
| --- | --- |
| Dashboard, Overview, Reports | Platform totals, verification counts, donation trends, categories, geography, fraud signals and campaign statuses; overview additionally includes underlying user/campaign/donation collections. |
| Users / member detail | Selected search/role results, account details and the member's campaign/giving records. |
| Campaigns / campaign detail | Search, status, category and pending queue; financial summary, story, contributions and collaborators. |
| Campaign staff review history | Every decision page, notes, versions, reviewers, status transitions and available reviewed public-content evidence; branded PDF/Excel/CSV. Erased snapshots remain absent. |
| Campaign split proceeds | Beneficiary balances, version history and allocations/consent. Separate export within the campaign record. |
| Donations | All matching named/anonymous donations, exact amount, currency, method and date. |
| Payouts | Selected review queue, all payouts or beneficiary queue; fees/net amounts remain separate where provided. |
| Disputes / dispute detail | Search/status results, reasons and resolutions. |
| Reports and moderation queues | Publication decisions, safety case summaries, selected statuses, refund recovery and store purchase/notification recovery. |
| Privacy requests | Separate deletion/retention and data-rights exports, with current request-status selection. |
| Verifications / KYC review | Current persisted verification queue, type/status/search, risk and review dates. Identity documents and document URLs are excluded. |
| Audit log | All pages matching the search, timestamps, actors, actions, severity and summaries. |
| Subscriptions / plans | Tier/status/search; billing provider, cycle and dates; plan prices and limits. A plan limit of -1 retains the API's unlimited sentinel. |
| Coupons | Search/active filter, codes, descriptions, discount type, amounts and redemption counts. Recipient lists are excluded. |
| Affiliates / affiliate detail | Selected affiliates or payouts; detail adds balances, referrals and commissions. Bank account details and recipient codes are excluded. |
| Roles | Built-in role/permission reference shown by the page. |
| Newsletter | Confirmed, actively opted-in subscribers matching the search, with confirmation dates. |
| Contact submissions / testimonials | All pages matching status/type and local search, including text content. |
| Payment providers / crypto operations | Configured provider status/fees, available assets/networks and the latest reconciliation result when one exists. Downloading never runs reconciliation. |
| AI usage | All usage pages and aggregate counts, without prompts, outputs or API secrets. |
| Profile / Settings | Administrator identity; effective persisted commercial and automatic-payout configuration. Passwords, MFA enrollment/recovery material and unsaved prototype settings are excluded. |
| Content: statistics, FAQs, About, Contact | Structured text and public content fields. An unsaved working copy is explicitly labelled as a draft; its saved timestamp remains separate. |
| Sign-in, password recovery, new-coupon form and not-found page | No persisted dataset to export. Saved coupons are exported from Coupons. |

## Data and authorization

Exports use explicit field selectors instead of serializing raw API objects. This keeps future credential, receipt and private-document fields out by default. Anonymous donors remain anonymous in exported attribution. Currency codes accompany amounts; timestamps use UTC. XLSX keeps numbers, dates, booleans and text IDs as distinct cell types. Text is never interpreted as an Excel formula. CSV uses UTF-8 with a BOM, quoted cells, escaped quotes and neutralized formula prefixes. Multi-section CSV uses Section/Record/Field/Value columns; XLSX uses separate worksheets and an export-details sheet.

The page's selected filters apply before client pagination, or are sent to the server while every matching page is fetched. `loadAll` rejects inconsistent totals, repeated IDs, empty intermediate pages, denied requests and cancellation instead of creating a partial file. Non-paginated API collections remain supported. The old public recent-donations source has been replaced in admin with a dedicated current-admin-only paginated read. Subscription reads now have bounded pages and a real total instead of stopping at 500 records. These changes do not widen public campaign/donation visibility.

Current administrator status is rechecked against the API before collecting data and immediately before downloading. Account/route changes abort the operation. Existing route permissions remain in force. Export authorization follows the current full-administrator backend model; it does not introduce delegated staff roles. Reports are generated from current reads, not a certified transactionally consistent financial snapshot. Concurrent collection changes detected during pagination require a retry.

## PDF branding

The shared template embeds Outfit Regular and Bold from the existing licensed Google Fonts package, with its OFL license bundled alongside the fonts. Colors match the current product theme: forest `#2E3D2F`, gold `#C7A24A`, sage `#A8B5A0` and warm ivory `#F5F2EA`. The interlocked-chain SVG matches `BrandLogo.tsx`; an unobtrusive UJIMORA watermark, repeated brand header, confidential-data footer and page numbers appear throughout.

Tables have repeated headings, bounded column widths and wrapped long values. Six to eight columns use landscape A4. Wider datasets use labelled field/value rows. Empty reports retain headings and an explicit no-records message. Font/conversion failures remain visible; the app does not silently substitute a generic PDF.

## Verification

- 35 focused API/visibility/plan tests pass, including 105 donations across pages, 505 subscriptions beyond the former cap, current-role revocation, private cache headers and exclusion of messages/store credentials. Public-read regressions remain passing.
- 51 admin tests pass, including real XLSX readback of 1,205 records, typed cells, formula safety, CSV quoting/Unicode, explicit-field privacy, pagination inconsistencies, cancellation and authorization revoked before download.
- Two Chromium flows pass: a 390px filtered user export retrieves matches from both server pages and downloads actual CSV/XLSX/PDF files; revoked staff access prevents download. Final UI screenshot inspected without horizontal overflow.
- Browser-generated PDF inspected with all eight columns visible. A 75-record multi-page PDF was rendered and inspected on initial, continuation and final pages. Text extraction confirms every record; `pdffonts` confirms embedded Outfit Regular/Bold subsets. Long email/date overflow found during verification was fixed and retested. Empty sections and a ten-field record with long story text were also rendered and inspected; a trailing blank page caused by table spacing was removed.
- API/admin type and lint checks and the production admin build pass. Export engines are separate lazy chunks; existing large-chunk advisories remain. An isolated npm 12 clean install applies the existing security patches and passes all six dependency consumer checks. No real provider transaction, user-data upload or external message was used.

Implementation references: [pdfmake client methods](https://pdfmake.github.io/docs/0.3/getting-started/client-side/methods/), [custom fonts](https://pdfmake.github.io/docs/0.3/fonts/custom-fonts-client-side/), [watermarks](https://pdfmake.github.io/docs/0.3/document-definition-object/watermark/) and [ExcelJS](https://github.com/exceljs/exceljs).
